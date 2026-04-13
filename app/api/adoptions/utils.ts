import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';
import { requireSession } from '@/lib/auth/session';

export type ShelterPetRecord = {
  type?: string;
  gender?: string;
  breed?: string;
  profileURL?: string;
  petName?: string;
  petAge?: string;
  petDescription?: string;
  requestStatus?: 'pending' | 'approved' | 'rejected' | null;
  deleteRequestId?: string | null;
  deleteRequestByUid?: string | null;
  request?: Record<
    string,
    {
      userID?: string;
      userId?: string;
      uid?: string;
      requestedAt?: string;
      status?: string;
    }
  >;
};

export type AdoptedPetRecord = ShelterPetRecord & {
  adoptedBy?: string;
  adoptedAt?: string;
  status?: string;
  adopterDetails?: {
    fullname?: string;
    contact?: string;
    address?: string | { fullAddress?: string };
    email?: string;
  };
};

export type AdoptionDeleteRequestRecord = {
  petId?: string;
  petName?: string;
  petStatus?: 'shelter' | 'adopted';
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
  address?: string | { fullAddress?: string };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const asShelterPetRecord = (value: unknown): ShelterPetRecord | null =>
  isRecord(value) ? (value as ShelterPetRecord) : null;

export const asAdoptedPetRecord = (value: unknown): AdoptedPetRecord | null =>
  isRecord(value) ? (value as AdoptedPetRecord) : null;

const getValidRequests = (value: ShelterPetRecord['request']) => {
  if (!isRecord(value)) {
    return [];
  }

  return Object.values(value).filter((request) => {
    if (!isRecord(request)) {
      return false;
    }

    return Boolean(request.userID || request.userId || request.uid);
  });
};

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

export const formatDate = (value?: string) => {
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

  return `${year}-${month}-${day}`;
};

export const formatDateTime = (value?: string) => {
  if (!value) {
    return 'Unknown';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const date = formatDate(value);
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return `${date} ${hours}:${minutes}`;
};

export const getUserFullName = (user: UserRecord | null | undefined) => {
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  return fullName || 'Unknown';
};

export const getAddress = (address?: string | { fullAddress?: string }) => {
  if (!address) {
    return 'Unknown';
  }

  if (typeof address === 'string') {
    return address;
  }

  return address.fullAddress || 'Unknown';
};

export const normalizeShelterPet = (id: string, pet: ShelterPetRecord) => ({
  id,
  status: 'shelter' as const,
  petName: pet.petName || 'No Name',
  petAge: pet.petAge || 'Unknown',
  type: pet.type || 'Unknown',
  gender: pet.gender || 'Unknown',
  breed: pet.breed || 'Unknown',
  description: pet.petDescription || 'No Description',
  profileURL: pet.profileURL || '/Profile.webp',
  requestCount: getValidRequests(pet.request).length,
  requestStatus:
    pet.requestStatus === 'pending' ||
    pet.requestStatus === 'approved' ||
    pet.requestStatus === 'rejected'
      ? pet.requestStatus
      : null,
});

export const normalizeAdoptedPet = (id: string, pet: AdoptedPetRecord) => ({
  id,
  status: 'adopted' as const,
  petName: pet.petName || 'No Name',
  petAge: pet.petAge || 'Unknown',
  type: pet.type || 'Unknown',
  gender: pet.gender || 'Unknown',
  breed: pet.breed || 'Unknown',
  description: pet.petDescription || 'No Description',
  profileURL: pet.profileURL || '/Profile.webp',
  requestCount: 0,
  requestStatus:
    pet.requestStatus === 'pending' ||
    pet.requestStatus === 'approved' ||
    pet.requestStatus === 'rejected'
      ? pet.requestStatus
      : null,
  adoptedBy: pet.adoptedBy || '',
  adoptedAt: formatDate(pet.adoptedAt),
  adopterName: pet.adopterDetails?.fullname || 'Unknown',
  adopterEmail: pet.adopterDetails?.email || 'Unknown',
  adopterContact: pet.adopterDetails?.contact || 'Unknown',
  adopterAddress: getAddress(pet.adopterDetails?.address),
});

export const databaseUrl = firebaseConfig.databaseURL;
