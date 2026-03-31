import { requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';

type LegacyUserRecord = {
  firstName?: string;
  lastName?: string;
  email?: string;
  contactNumber?: string;
  profilePic?: string;
  address?: {
    fullAddress?: string;
  };
};

type LegacyPetRecord = {
  ownerDetails?: {
    fullName?: string;
  };
};

const getIdTokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
};

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const idToken = getIdTokenFromRequest(request);

    if (!idToken) {
      return Response.json({ error: 'Missing Firebase token.' }, { status: 401 });
    }

    const authUser = await verifyFirebaseIdToken(idToken);

    if (!authUser || authUser.uid !== session.uid) {
      return Response.json({ error: 'Invalid Firebase session.' }, { status: 401 });
    }

    const [usersResponse, petsResponse] = await Promise.all([
      fetch(`${firebaseConfig.databaseURL}/users.json?auth=${encodeURIComponent(idToken)}`, {
        cache: 'no-store',
      }),
      fetch(`${firebaseConfig.databaseURL}/pets.json?auth=${encodeURIComponent(idToken)}`, {
        cache: 'no-store',
      }),
    ]);

    if (!usersResponse.ok) {
      return Response.json({ error: 'Failed to load users.' }, { status: usersResponse.status });
    }

    if (!petsResponse.ok) {
      return Response.json({ error: 'Failed to load pets.' }, { status: petsResponse.status });
    }

    const usersData = (await usersResponse.json()) as Record<string, LegacyUserRecord> | null;
    const petsData = (await petsResponse.json()) as Record<string, LegacyPetRecord> | null;

    const petCountByOwner = new Map<string, number>();

    Object.values(petsData ?? {}).forEach((pet) => {
      const fullName = pet.ownerDetails?.fullName?.trim().toLowerCase();

      if (!fullName) {
        return;
      }

      petCountByOwner.set(fullName, (petCountByOwner.get(fullName) ?? 0) + 1);
    });

    const users = Object.entries(usersData ?? {})
      .map(([id, user]) => {
        const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'No name';
        const normalizedName = name.toLowerCase();

        return {
          id,
          name,
          email: user.email || 'No email',
          contact: user.contactNumber || 'No contact',
          address: user.address?.fullAddress || 'No address',
          profilePic: user.profilePic || '/Fur-Dentity/Profile.webp',
          petsCount: petCountByOwner.get(normalizedName) ?? 0,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return Response.json({ users });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load users.' }, { status: 500 });
  }
}
