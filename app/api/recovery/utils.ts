import { requireSession } from '@/lib/auth/session';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';

export type RecoveryModule =
  | 'admins'
  | 'users'
  | 'pets'
  | 'donation'
  | 'petShelterList'
  | 'adoptedPets'
  | 'reports';

export type ArchivedRecord = Record<string, unknown> & {
  deletedAt?: string;
  name?: string;
  petName?: string;
  status?: string;
  amount?: number | string;
  platform?: string;
  type?: string;
};

export const getIdTokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
};

export const requireVerifiedSuperAdmin = async (request: Request) => {
  const session = await requireSession();

  if (session.role !== 'super_admin') {
    return {
      error: Response.json({ error: 'Only super admins can access recovery.' }, { status: 403 }),
    };
  }

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

export const sanitizeRestoredRecord = (record: ArchivedRecord) => {
  const {
    deletedAt: _deletedAt,
    requestStatus: _requestStatus,
    deleteRequestId: _deleteRequestId,
    deleteRequestByUid: _deleteRequestByUid,
    ...restored
  } = record;

  void _deletedAt;
  void _requestStatus;
  void _deleteRequestId;
  void _deleteRequestByUid;

  return restored;
};

export const getRecoveryPaths = ({
  module,
  id,
  reportMainDir,
  reportSubDir,
}: {
  module: RecoveryModule;
  id: string;
  reportMainDir?: string;
  reportSubDir?: string;
}) => {
  if (module === 'donation') {
    return {
      archivePath: `donation/${id}`,
      restorePath: `donations/${id}`,
    };
  }

  if (module === 'admins') {
    return {
      archivePath: `admins/${id}`,
      restorePath: `admins/${id}`,
    };
  }

  if (module === 'users') {
    return {
      archivePath: `users/${id}`,
      restorePath: `users/${id}`,
    };
  }

  if (module === 'pets') {
    return {
      archivePath: `pets/${id}`,
      restorePath: `pets/${id}`,
    };
  }

  if (module === 'petShelterList') {
    return {
      archivePath: `petShelterList/${id}`,
      restorePath: `catalogs/petShelterList/${id}`,
    };
  }

  if (module === 'adoptedPets') {
    return {
      archivePath: `adoptedPets/${id}`,
      restorePath: `catalogs/adoptedPets/${id}`,
    };
  }

  if (!reportMainDir || !reportSubDir) {
    return null;
  }

  return {
    archivePath: `reports/${reportMainDir}/${reportSubDir}/${id}`,
    restorePath: `tickets/${reportMainDir}/${reportSubDir}/${id}`,
  };
};

export const formatRecoveredModule = (module: RecoveryModule) => {
  if (module === 'admins') {
    return 'System Admin';
  }

  if (module === 'users') {
    return 'User';
  }

  if (module === 'pets') {
    return 'Registered Pet';
  }

  if (module === 'donation') {
    return 'Donation';
  }

  if (module === 'petShelterList') {
    return 'Shelter Pet';
  }

  if (module === 'adoptedPets') {
    return 'Adopted Pet';
  }

  return 'Report';
};

export const getRecordName = (module: RecoveryModule, record: ArchivedRecord, id: string) => {
  if (module === 'admins') {
    return String(record.name || record.email || id);
  }

  if (module === 'users') {
    const fullName = `${String(record.firstName || '')} ${String(record.lastName || '')}`.trim();
    return fullName || String(record.email || id);
  }

  if (module === 'pets') {
    const petDetails = record.petDetails && typeof record.petDetails === 'object'
      ? (record.petDetails as Record<string, unknown>)
      : {};

    return String(petDetails.petName || record.name || id);
  }

  if (module === 'donation') {
    return record.name ? `Donation by ${record.name}` : `Donation ${id}`;
  }

  if (module === 'reports') {
    return String(record.petName || record.petID || record.status || `Report ${id}`);
  }

  return String(record.petName || record.name || id);
};
