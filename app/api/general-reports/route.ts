import { requireSession } from '@/lib/auth/session';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';
import { firebaseConfig } from '@/lib/firebase-config';
import { normalizeActivityLog, type ActivityLogRecord } from '../activity-logs/utils';

type UnknownRecord = Record<string, unknown>;
type ReportModule = 'all' | 'users' | 'pets' | 'adoption' | 'donation' | 'reports' | 'activity';

type DonationRecord = {
  amount?: number | string;
  date?: string;
  platform?: string;
};

type TicketRecord = {
  reportType?: 'missing' | 'found' | 'other';
  status?: string;
  submittedAt?: string;
};

type ShelterPetRecord = {
  type?: string;
  petType?: string;
  petDetails?: {
    petType?: string;
    type?: string;
  };
  breed?: string;
  request?: Record<string, unknown>;
};

type AdoptedPetRecord = {
  type?: string;
  petType?: string;
  petDetails?: {
    petType?: string;
    type?: string;
  };
  breed?: string;
  adoptedAt?: string;
};

const databaseUrl = firebaseConfig.databaseURL;
const allowedModules = new Set<ReportModule>([
  'all',
  'users',
  'pets',
  'adoption',
  'donation',
  'reports',
  'activity',
]);

const getIdTokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
};

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asRecordMap = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const fetchJson = async (path: string, idToken: string) => {
  const response = await fetch(`${databaseUrl}/${path}.json?auth=${encodeURIComponent(idToken)}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to load ${path}.`);
  }

  return response.json() as Promise<unknown>;
};

const fetchJsonOptional = async (path: string, idToken: string) => {
  try {
    return await fetchJson(path, idToken);
  } catch (error) {
    console.warn(`General report skipped ${path}:`, error);
    return null;
  }
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

const countBy = <T,>(rows: T[], selector: (row: T) => string | undefined) => {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const key = selector(row)?.trim() || 'Unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label))
    .slice(0, 8);
};

const sumDonations = (rows: DonationRecord[]) =>
  rows.reduce((total, donation) => total + Number(donation.amount || 0), 0);

const formatMonthYear = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);

const isCurrentMonth = (value: unknown, now: Date) => {
  if (!value) {
    return false;
  }

  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getFullYear() === now.getFullYear() && parsed.getMonth() === now.getMonth();
};

const normalizePetType = (value: unknown) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized.includes('cat')) {
    return 'Cat';
  }

  if (normalized.includes('dog')) {
    return 'Dog';
  }

  return 'Unknown';
};

const getNestedValue = (record: UnknownRecord, path: string[]) => {
  let current: unknown = record;

  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[key];
  }

  return current;
};

const getPetType = (pet: unknown) => {
  const record = asRecordMap(pet);

  return normalizePetType(
    record.type ||
      record.petType ||
      record.species ||
      record.pet_type ||
      record.animalType ||
      getNestedValue(record, ['petDetails', 'petType']) ||
      getNestedValue(record, ['petDetails', 'type']) ||
      getNestedValue(record, ['basicInformation', 'petType']) ||
      getNestedValue(record, ['basicInformation', 'type'])
  );
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

    const url = new URL(request.url);
    const moduleParam = url.searchParams.get('module') ?? 'all';
    const selectedModule = allowedModules.has(moduleParam as ReportModule)
      ? (moduleParam as ReportModule)
      : 'all';
    const now = new Date();

    if (selectedModule === 'activity' && verified.session.role !== 'super_admin') {
      return Response.json({ error: 'Only super admins can generate activity reports.' }, { status: 403 });
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
      fetchJsonOptional('users', verified.idToken),
      fetchJsonOptional('pets', verified.idToken),
      fetchJsonOptional('donations', verified.idToken),
      fetchJsonOptional('tickets', verified.idToken),
      fetchJsonOptional('catalogs/petShelterList', verified.idToken),
      fetchJsonOptional('catalogs/adoptedPets', verified.idToken),
      fetchJsonOptional('donationDeleteRequests', verified.idToken),
      fetchJsonOptional('adoptionDeleteRequests', verified.idToken),
      fetchJsonOptional('reportDeleteRequests', verified.idToken),
      verified.session.role === 'super_admin'
        ? fetchJsonOptional('activityLogs', verified.idToken)
        : Promise.resolve(null),
    ]);

    const userRows = Object.values(asRecordMap(users)).filter(isRecord);
    const petRows = Object.values(asRecordMap(pets)).filter(isRecord);
    const donationRows = Object.values(asRecordMap(donations)).filter(isRecord) as DonationRecord[];
    const reportRows = getTicketRecords(tickets);
    const shelterRows = Object.values(asRecordMap(shelterPets)).filter(isRecord) as ShelterPetRecord[];
    const adoptedRows = Object.values(asRecordMap(adoptedPets)).filter(isRecord) as AdoptedPetRecord[];
    const rangedDonations = donationRows.filter((donation) => isCurrentMonth(donation.date, now));
    const rangedReports = reportRows.filter((report) => isCurrentMonth(report.submittedAt, now));
    const rangedAdopted = adoptedRows.filter((pet) => isCurrentMonth(pet.adoptedAt, now));
    const activityRows =
      verified.session.role === 'super_admin'
        ? Object.entries(asRecordMap(activityLogs))
            .map(([id, log]) => normalizeActivityLog(id, log as ActivityLogRecord))
            .filter((log) => isCurrentMonth(log.createdAt, now))
        : [];

    return Response.json({
      generatedAt: new Date().toISOString(),
      filters: {
        module: selectedModule,
        periodLabel: formatMonthYear(now),
      },
      role: verified.session.role,
      summary: {
        users: userRows.length,
        pets: petRows.length,
        shelterPets: shelterRows.length,
        adoptedPets: adoptedRows.length,
        donations: rangedDonations.length,
        donationAmount: sumDonations(rangedDonations),
        reports: rangedReports.length,
        missingReports: rangedReports.filter((report) => report.reportType === 'missing').length,
        foundReports: rangedReports.filter((report) => report.reportType === 'found').length,
        adoptionRequests: shelterRows.reduce((total, pet) => total + getValidAdoptionRequestCount(pet.request), 0),
        completedAdoptions: rangedAdopted.length,
        pendingDeleteRequests:
          Object.keys(asRecordMap(donationDeleteRequests)).length +
          Object.keys(asRecordMap(adoptionDeleteRequests)).length +
          Object.keys(asRecordMap(reportDeleteRequests)).length,
        activityLogs: activityRows.length,
      },
      sections: {
        users: {
          total: userRows.length,
        },
        pets: {
          total: petRows.length,
          byType: countBy(petRows, getPetType),
        },
        adoption: {
          shelterPets: shelterRows.length,
          adoptedPets: adoptedRows.length,
          completedInRange: rangedAdopted.length,
          pendingRequests: shelterRows.reduce((total, pet) => total + getValidAdoptionRequestCount(pet.request), 0),
          byType: countBy([...shelterRows, ...adoptedRows], getPetType),
        },
        donation: {
          count: rangedDonations.length,
          totalAmount: sumDonations(rangedDonations),
          byPlatform: countBy(rangedDonations, (donation) => donation.platform),
        },
        reports: {
          total: rangedReports.length,
          byType: countBy(rangedReports, (report) => report.reportType),
          byStatus: countBy(rangedReports, (report) => report.status),
        },
        activity:
          verified.session.role === 'super_admin'
            ? {
                total: activityRows.length,
                recent: activityRows
                  .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
                  .slice(0, 8)
                  .map((log) => ({
                    id: log.id,
                    description: log.description,
                    actor: log.actor.name,
                    createdAt: log.createdAt,
                  })),
              }
            : null,
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to generate the general report.' }, { status: 500 });
  }
}
