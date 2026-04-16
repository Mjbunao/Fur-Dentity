import { requireSession } from '@/lib/auth/session';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';
import { firebaseConfig } from '@/lib/firebase-config';
import {
  encodeReportKey,
  formatDirectoryName,
  type PetRecord,
  type TicketRecord,
  type UserRecord,
} from '../reports/utils';
import { getUserFullName, type ShelterPetRecord } from '../adoptions/utils';

type UnknownRecord = Record<string, unknown>;

type NotificationState = {
  read?: Record<string, boolean>;
  deleted?: Record<string, boolean>;
};

type StoredNotificationRecord = {
  type?: 'delete_request_resolved';
  title?: string;
  description?: string;
  href?: string;
  createdAt?: string;
};

type NotificationRow = {
  id: string;
  type: 'report' | 'adoption_request' | 'delete_request' | 'delete_request_resolved';
  title: string;
  description: string;
  href: string;
  createdAt: string;
  read: boolean;
};

type DonationDeleteRequestRecord = {
  donationId?: string;
  donationName?: string;
  requestedByName?: string;
  status?: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
};

type AdoptionDeleteRequestRecord = {
  petId?: string;
  petName?: string;
  requestedByName?: string;
  status?: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
};

type ReportDeleteRequestRecord = {
  reportKey?: string;
  petName?: string;
  requestedByName?: string;
  status?: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
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

const formatDateTime = (value?: string) => {
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

const getRequestUserId = (request: unknown, fallbackId: string) => {
  if (typeof request === 'string') {
    return request;
  }

  if (!isRecord(request)) {
    return fallbackId;
  }

  const userId = request.userID || request.userId || request.uid;
  return typeof userId === 'string' ? userId : fallbackId;
};

const getRequestCreatedAt = (request: unknown) => {
  if (!isRecord(request) || typeof request.requestedAt !== 'string') {
    return '';
  }

  return request.requestedAt;
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
      tickets,
      users,
      pets,
      shelterPets,
      donationDeleteRequests,
      adoptionDeleteRequests,
      reportDeleteRequests,
      notificationState,
      storedNotifications,
    ] = await Promise.all([
      fetchJson('tickets', verified.idToken),
      fetchJson('users', verified.idToken),
      fetchJson('pets', verified.idToken),
      fetchJson('catalogs/petShelterList', verified.idToken),
      verified.session.role === 'super_admin'
        ? fetchJson('donationDeleteRequests', verified.idToken)
        : Promise.resolve(null),
      verified.session.role === 'super_admin'
        ? fetchJson('adoptionDeleteRequests', verified.idToken)
        : Promise.resolve(null),
      verified.session.role === 'super_admin'
        ? fetchJson('reportDeleteRequests', verified.idToken)
        : Promise.resolve(null),
      fetchJson(`web-admin/${verified.session.uid}/notificationState`, verified.idToken).catch(() => null),
      fetchJson(`web-admin/${verified.session.uid}/notifications`, verified.idToken).catch(() => null),
    ]);

    const usersMap = asRecordMap(users) as Record<string, UserRecord>;
    const petsMap = asRecordMap(pets) as Record<string, PetRecord>;
    const read = ((notificationState as NotificationState | null)?.read ?? {}) as Record<string, boolean>;
    const deleted = ((notificationState as NotificationState | null)?.deleted ?? {}) as Record<string, boolean>;
    const notifications: NotificationRow[] = [];

    const pushNotification = (notification: Omit<NotificationRow, 'read'>) => {
      if (deleted[notification.id]) {
        return;
      }

      notifications.push({
        ...notification,
        read: Boolean(read[notification.id]),
      });
    };

    for (const [notificationId, notificationValue] of Object.entries(asRecordMap(storedNotifications))) {
      if (!isRecord(notificationValue)) {
        continue;
      }

      const notification = notificationValue as StoredNotificationRecord;

      pushNotification({
        id: `stored_${notificationId}`,
        type: notification.type || 'delete_request_resolved',
        title: notification.title || 'Request update',
        description: notification.description || 'A request has been updated.',
        href: notification.href || '/dashboard',
        createdAt: notification.createdAt || '',
      });
    }

    for (const [mainDir, subDirs] of Object.entries(asRecordMap(tickets))) {
      for (const [subDir, reports] of Object.entries(asRecordMap(subDirs))) {
        for (const [reportId, reportValue] of Object.entries(asRecordMap(reports))) {
          if (!isRecord(reportValue)) {
            continue;
          }

          const report = reportValue as TicketRecord;
          const reportType = formatDirectoryName(mainDir);
          const reporterId = report.submittedByUID || report.submittedBy || '';
          const reporter = reporterId ? usersMap[reporterId] : null;
          const pet = report.petID ? petsMap[report.petID] : null;
          const petName = report.petID
            ? pet?.petDetails?.petName || report.petName || 'No Name'
            : report.petName || 'No Name';

          pushNotification({
            id: `report_${mainDir}_${subDir}_${reportId}`,
            type: 'report',
            title: `${getUserFullName(reporter)} reported a ${reportType} pet`,
            description: `${petName} - Submitted ${formatDateTime(report.submittedAt)}`,
            href: `/reports/${encodeReportKey(mainDir, subDir, reportId)}`,
            createdAt: report.submittedAt || '',
          });
        }
      }
    }

    for (const [petId, petValue] of Object.entries(asRecordMap(shelterPets))) {
      if (!isRecord(petValue)) {
        continue;
      }

      const pet = petValue as ShelterPetRecord;

      for (const [requestId, requestValue] of Object.entries(asRecordMap(pet.request))) {
        const userId = getRequestUserId(requestValue, requestId);
        const looksLikePlaceholder = userId === 'userID' || userId === 'userId' || userId === 'uid';

        if (looksLikePlaceholder) {
          continue;
        }

        const requestedAt = getRequestCreatedAt(requestValue) || new Date(0).toISOString();

        pushNotification({
          id: `adoption_${petId}_${requestId}`,
          type: 'adoption_request',
          title: `${getUserFullName(usersMap[userId])} requested to adopt`,
          description: `${pet.petName || 'No Name'} - Requested ${formatDateTime(requestedAt)}`,
          href: `/adoption/${encodeURIComponent(petId)}`,
          createdAt: requestedAt,
        });
      }
    }

    if (verified.session.role === 'super_admin') {
      for (const [requestId, requestValue] of Object.entries(asRecordMap(donationDeleteRequests))) {
        if (!isRecord(requestValue)) {
          continue;
        }

        const requestRecord = requestValue as DonationDeleteRequestRecord;
        if (requestRecord.status !== 'pending' || !requestRecord.donationId) {
          continue;
        }

        pushNotification({
          id: `delete_donation_${requestId}`,
          type: 'delete_request',
          title: `${requestRecord.requestedByName || 'System Admin'} requested donation deletion`,
          description: `${requestRecord.donationName || 'Unknown donation'} - Requested ${formatDateTime(requestRecord.createdAt)}`,
          href: '/donation',
          createdAt: requestRecord.createdAt || '',
        });
      }

      for (const [requestId, requestValue] of Object.entries(asRecordMap(adoptionDeleteRequests))) {
        if (!isRecord(requestValue)) {
          continue;
        }

        const requestRecord = requestValue as AdoptionDeleteRequestRecord;
        if (requestRecord.status !== 'pending' || !requestRecord.petId) {
          continue;
        }

        pushNotification({
          id: `delete_adoption_${requestId}`,
          type: 'delete_request',
          title: `${requestRecord.requestedByName || 'System Admin'} requested adoption deletion`,
          description: `${requestRecord.petName || 'Unknown pet'} - Requested ${formatDateTime(requestRecord.createdAt)}`,
          href: '/adoption',
          createdAt: requestRecord.createdAt || '',
        });
      }

      for (const [requestId, requestValue] of Object.entries(asRecordMap(reportDeleteRequests))) {
        if (!isRecord(requestValue)) {
          continue;
        }

        const requestRecord = requestValue as ReportDeleteRequestRecord;
        if (requestRecord.status !== 'pending' || !requestRecord.reportKey) {
          continue;
        }

        pushNotification({
          id: `delete_report_${requestId}`,
          type: 'delete_request',
          title: `${requestRecord.requestedByName || 'System Admin'} requested report deletion`,
          description: `${requestRecord.petName || 'Unknown pet'} - Requested ${formatDateTime(requestRecord.createdAt)}`,
          href: '/reports',
          createdAt: requestRecord.createdAt || '',
        });
      }
    }

    const sortedNotifications = notifications.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );

    return Response.json({
      notifications: sortedNotifications.slice(0, 30),
      unreadCount: sortedNotifications.filter((notification) => !notification.read).length,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load notifications.' }, { status: 500 });
  }
}
