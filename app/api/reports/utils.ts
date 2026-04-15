import { requireSession } from '@/lib/auth/session';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';
import { firebaseConfig } from '@/lib/firebase-config';

export type ReportStatus = 'Pending' | 'Received' | 'Processing' | 'Rejected' | 'Finished';
export type ReportKind = 'found' | 'missing' | 'other';
export type RegistrationType = 'registered' | 'unregistered';

export type TicketRecord = {
  dateLastSeen?: string;
  details?: string;
  finishedAt?: string;
  image?: string;
  lastSeen?: string;
  openedAt?: number;
  petDetails?: {
    age?: string;
    birthdate?: string;
    breed?: string;
    colors?: Record<string, string>;
  };
  petID?: string;
  petName?: string;
  rejectedAt?: string;
  requestStatus?: 'pending' | 'approved' | 'rejected' | null;
  deleteRequestId?: string | null;
  deleteRequestByUid?: string | null;
  state?: string;
  status?: ReportStatus | string;
  submittedAt?: string;
  submittedBy?: string;
  submittedByUID?: string;
};

export type ReportDeleteRequestRecord = {
  reportKey?: string;
  reportId?: string;
  mainDir?: string;
  subDir?: string;
  reportType?: ReportKind;
  petName?: string;
  reportStatus?: ReportStatus;
  requestedByUid?: string;
  requestedByName?: string;
  requestedByEmail?: string;
  status?: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
};

export type UserRecord = {
  firstName?: string;
  lastName?: string;
  email?: string;
  contactNumber?: string;
};

export type PetRecord = {
  petDetails?: {
    image?: string;
    petName?: string;
  };
};

export const databaseUrl = firebaseConfig.databaseURL;

export const getIdTokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
};

export const requireVerifiedAdmin = async (request: Request) => {
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

export const encodeReportKey = (mainDir: string, subDir: string, reportId: string) =>
  encodeURIComponent(`${mainDir}:${subDir}:${reportId}`);

export const decodeReportKey = (reportKey: string) => {
  const [mainDir, subDir, ...reportIdParts] = decodeURIComponent(reportKey).split(':');
  const reportId = reportIdParts.join(':');

  if (!mainDir || !subDir || !reportId) {
    return null;
  }

  return { mainDir, subDir, reportId };
};

export const formatDirectoryName = (mainDir: string): ReportKind => {
  if (mainDir === 'missing_pets') {
    return 'missing';
  }

  if (mainDir === 'found_pets') {
    return 'found';
  }

  return 'other';
};

export const formatDateTime = (value?: string) => {
  if (!value) {
    return 'Unknown';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

export const normalizeStatus = (status?: string): ReportStatus => {
  const normalized = (status || 'Pending').toLowerCase();

  if (normalized === 'received') {
    return 'Received';
  }

  if (normalized === 'processing') {
    return 'Processing';
  }

  if (normalized === 'rejected') {
    return 'Rejected';
  }

  if (normalized === 'finished') {
    return 'Finished';
  }

  return 'Pending';
};

export const getUserFullName = (user?: UserRecord | null) => {
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  return fullName || 'Unknown Reporter';
};

export const getColors = (colors?: Record<string, string>) =>
  Object.values(colors ?? {}).filter((color): color is string => Boolean(color));

export const buildReportRow = ({
  mainDir,
  subDir,
  reportId,
  report,
  reporter,
  pet,
}: {
  mainDir: string;
  subDir: string;
  reportId: string;
  report: TicketRecord;
  reporter?: UserRecord | null;
  pet?: PetRecord | null;
}) => {
  const petName = report.petID
    ? pet?.petDetails?.petName || report.petName || 'No Name'
    : report.petName || 'No Name';
  const status = normalizeStatus(report.status);
  const reportType = formatDirectoryName(mainDir);

  return {
    id: encodeReportKey(mainDir, subDir, reportId),
    reportId,
    mainDir,
    subDir,
    reportType,
    registrationType: report.petID ? 'registered' as RegistrationType : 'unregistered' as RegistrationType,
    reporterName: getUserFullName(reporter),
    reporterEmail: reporter?.email || 'No email',
    reporterContact: reporter?.contactNumber || 'No contact',
    petId: report.petID || '',
    petName,
    status,
    requestStatus:
      report.requestStatus === 'pending' ||
      report.requestStatus === 'approved' ||
      report.requestStatus === 'rejected'
        ? report.requestStatus
        : null,
    submittedAt: report.submittedAt || '',
    submittedAtLabel: formatDateTime(report.submittedAt),
    finishedAt: report.finishedAt || '',
    finishedAtLabel: formatDateTime(report.finishedAt),
    opened: Boolean(report.openedAt),
    lastSeen: report.lastSeen || 'Unknown',
    dateLastSeen: report.dateLastSeen || 'Unknown',
    state: report.state || 'Unknown',
    details: report.details || 'No description',
    reportImage: report.image || '',
    petImage: pet?.petDetails?.image || '/Profile.webp',
    petDetails: {
      age: report.petDetails?.age || 'Unknown',
      birthdate: report.petDetails?.birthdate || 'Unknown',
      breed: report.petDetails?.breed || 'Unknown',
      colors: getColors(report.petDetails?.colors),
    },
  };
};
