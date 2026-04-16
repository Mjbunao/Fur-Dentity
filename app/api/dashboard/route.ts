import { requireSession } from '@/lib/auth/session';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';
import { firebaseConfig } from '@/lib/firebase-config';
import { normalizeActivityLog, type ActivityLogRecord } from '../activity-logs/utils';

type UnknownRecord = Record<string, unknown>;

type DonationRecord = {
  amount?: number | string;
  date?: string;
  requestStatus?: 'pending' | 'approved' | 'rejected' | null;
  deleteRequestByUid?: string | null;
};

type TicketRecord = {
  reportType?: 'missing' | 'found' | 'other';
  status?: string;
  submittedAt?: string;
  requestStatus?: 'pending' | 'approved' | 'rejected' | null;
  deleteRequestByUid?: string | null;
};

type ShelterPetRecord = {
  request?: Record<string, unknown>;
  requestStatus?: 'pending' | 'approved' | 'rejected' | null;
  deleteRequestByUid?: string | null;
};

type AdoptedPetRecord = {
  adoptedAt?: string;
  requestStatus?: 'pending' | 'approved' | 'rejected' | null;
  deleteRequestByUid?: string | null;
};

const databaseUrl = firebaseConfig.databaseURL;

const getIdTokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
};

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asRecordMap = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

const countRecords = (value: unknown) => Object.keys(asRecordMap(value)).length;

const hasOwnPendingDeleteRequest = (
  record: {
    requestStatus?: string | null;
    deleteRequestByUid?: string | null;
  },
  uid: string
) => record.requestStatus === 'pending' && record.deleteRequestByUid === uid;

const isSameMonth = (value: string | undefined, now = new Date()) => {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getFullYear() === now.getFullYear() && parsed.getMonth() === now.getMonth();
};

const getMonthIndex = (value?: string) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.getMonth();
};

const getValidAdoptionRequestCount = (request: ShelterPetRecord['request']) => {
  if (!isRecord(request)) {
    return 0;
  }

  return Object.values(request).filter((value) => {
    if (!isRecord(value)) {
      return false;
    }

    return Boolean(value.userID || value.userId || value.uid);
  }).length;
};

const getTicketRecords = (tickets: unknown) => {
  const records: TicketRecord[] = [];

  for (const [mainKey, mainValue] of Object.entries(asRecordMap(tickets))) {
    const reportType: TicketRecord['reportType'] =
      mainKey === 'missing_pets' ? 'missing' : mainKey === 'found_pets' ? 'found' : 'other';

    for (const subValue of Object.values(asRecordMap(mainValue))) {
      const subRecord = asRecordMap(subValue);
      const values = Object.values(subRecord);
      const looksLikeReportGroup = values.some((value) => isRecord(value) && 'submittedAt' in value);

      if (looksLikeReportGroup) {
        records.push(...values.filter(isRecord).map((value) => ({ ...(value as TicketRecord), reportType })));
      } else if ('submittedAt' in subRecord || 'status' in subRecord) {
        records.push({ ...(subRecord as TicketRecord), reportType });
      }
    }
  }

  return records;
};

const fetchJson = async (path: string, idToken: string) => {
  const response = await fetch(`${databaseUrl}/${path}.json?auth=${encodeURIComponent(idToken)}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${path}.`);
  }

  return response.json() as Promise<unknown>;
};

const requireVerifiedAdmin = async (request: Request) => {
  const session = await requireSession();
  const idToken = getIdTokenFromRequest(request);

  if (!idToken) {
    return {
      error: Response.json({ error: 'Missing Firebase token.' }, { status: 401 }),
    };
  }

  const authUser = await verifyFirebaseIdToken(idToken);
  if (!authUser || authUser.uid !== session.uid) {
    return {
      error: Response.json({ error: 'Invalid Firebase session.' }, { status: 401 }),
    };
  }

  return { session, idToken };
};

export async function GET(request: Request) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const [
      users,
      pets,
      donations,
      tickets,
      shelterPets,
      adoptedPets,
      donationDeleteRequests,
      adoptionDeleteRequests,
      reportDeleteRequests,
      activityLogs,
    ] = await Promise.all([
      fetchJson('users', verified.idToken),
      fetchJson('pets', verified.idToken),
      fetchJson('donations', verified.idToken),
      fetchJson('tickets', verified.idToken),
      fetchJson('catalogs/petShelterList', verified.idToken),
      fetchJson('catalogs/adoptedPets', verified.idToken),
      verified.session.role === 'super_admin'
        ? fetchJson('donationDeleteRequests', verified.idToken)
        : Promise.resolve(null),
      verified.session.role === 'super_admin'
        ? fetchJson('adoptionDeleteRequests', verified.idToken)
        : Promise.resolve(null),
      verified.session.role === 'super_admin'
        ? fetchJson('reportDeleteRequests', verified.idToken)
        : Promise.resolve(null),
      verified.session.role === 'super_admin'
        ? fetchJson('activityLogs', verified.idToken)
        : Promise.resolve(null),
    ]);

    const now = new Date();
    const donationRows = Object.values(asRecordMap(donations)).filter(isRecord) as DonationRecord[];
    const reportRows = getTicketRecords(tickets);
    const shelterRows = Object.values(asRecordMap(shelterPets)).filter(isRecord) as ShelterPetRecord[];
    const adoptedRows = Object.values(asRecordMap(adoptedPets)).filter(isRecord) as AdoptedPetRecord[];
    const pendingDonationDeleteRequests =
      verified.session.role === 'super_admin'
        ? Object.values(asRecordMap(donationDeleteRequests)).filter(
            (requestRecord) => !isRecord(requestRecord) || requestRecord.status === 'pending'
          ).length
        : donationRows.filter((donation) => hasOwnPendingDeleteRequest(donation, verified.session.uid)).length;
    const pendingAdoptionDeleteRequests =
      verified.session.role === 'super_admin'
        ? Object.values(asRecordMap(adoptionDeleteRequests)).filter(
            (requestRecord) => !isRecord(requestRecord) || requestRecord.status === 'pending'
          ).length
        : [...shelterRows, ...adoptedRows].filter((pet) =>
            hasOwnPendingDeleteRequest(pet, verified.session.uid)
          ).length;
    const pendingReportDeleteRequests =
      verified.session.role === 'super_admin'
        ? Object.values(asRecordMap(reportDeleteRequests)).filter(
            (requestRecord) => !isRecord(requestRecord) || requestRecord.status === 'pending'
          ).length
        : reportRows.filter((report) => hasOwnPendingDeleteRequest(report, verified.session.uid)).length;

    const recentActivity =
      verified.session.role === 'super_admin'
        ? Object.entries(asRecordMap(activityLogs))
            .map(([id, log]) => normalizeActivityLog(id, log as ActivityLogRecord))
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .slice(0, 5)
        : [];
    const missingReportsByMonth = new Array(12).fill(0) as number[];
    const foundReportsByMonth = new Array(12).fill(0) as number[];
    const adoptedPetsByMonth = new Array(12).fill(0) as number[];
    const donationAmountByMonth = new Array(12).fill(0) as number[];

    for (const report of reportRows) {
      const monthIndex = getMonthIndex(report.submittedAt);
      if (monthIndex === null) {
        continue;
      }

      if (report.reportType === 'missing') {
        missingReportsByMonth[monthIndex] += 1;
      }

      if (report.reportType === 'found') {
        foundReportsByMonth[monthIndex] += 1;
      }
    }

    for (const adoptedPet of adoptedRows) {
      const monthIndex = getMonthIndex(adoptedPet.adoptedAt);
      if (monthIndex !== null) {
        adoptedPetsByMonth[monthIndex] += 1;
      }
    }

    for (const donation of donationRows) {
      const monthIndex = getMonthIndex(donation.date);
      if (monthIndex !== null) {
        donationAmountByMonth[monthIndex] += Number(donation.amount || 0);
      }
    }

    return Response.json({
      summary: {
        users: countRecords(users),
        pets: countRecords(pets),
        shelterPets: shelterRows.length,
        adoptedPets: adoptedRows.length,
        reportsThisMonth: reportRows.filter((report) => isSameMonth(report.submittedAt, now)).length,
        adoptionRequests: shelterRows.reduce(
          (total, pet) => total + getValidAdoptionRequestCount(pet.request),
          0
        ),
        donationsThisMonth: donationRows
          .filter((donation) => isSameMonth(donation.date, now))
          .reduce((total, donation) => total + Number(donation.amount || 0), 0),
      },
      queues: {
        donationDeleteRequests: pendingDonationDeleteRequests,
        adoptionDeleteRequests: pendingAdoptionDeleteRequests,
        reportDeleteRequests: pendingReportDeleteRequests,
      },
      charts: {
        missingReportsByMonth,
        foundReportsByMonth,
        adoptedPetsByMonth,
        donationAmountByMonth,
      },
      recentActivity,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load dashboard summary.' }, { status: 500 });
  }
}
