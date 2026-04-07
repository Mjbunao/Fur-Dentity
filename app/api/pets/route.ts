import { requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';

type LegacyPetRecord = {
  petDetails?: {
    petName?: string;
    petType?: string;
    breed?: string;
    birthdate?: string;
    image?: string;
    colors?: Record<string, string>;
    petColors?: Record<string, string>;
    color?: Record<string, string>;
  };
  ownerDetails?: {
    fullName?: string;
    address?: string;
    contactNumber?: string;
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

    const response = await fetch(
      `${firebaseConfig.databaseURL}/pets.json?auth=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to load pets.' }, { status: response.status });
    }

    const petsData = (await response.json()) as Record<string, LegacyPetRecord> | null;

    const pets = Object.entries(petsData ?? {})
      .map(([id, pet]) => {
        const petDetails = pet.petDetails ?? {};
        const ownerDetails = pet.ownerDetails ?? {};

        return {
          id,
          name: petDetails.petName || 'Unknown',
          type: petDetails.petType || 'Unknown',
          breed: petDetails.breed || 'Unknown',
          birthdate: petDetails.birthdate || 'Unknown',
          image: petDetails.image || '/Profile.webp',
          owner: ownerDetails.fullName || 'Unknown',
          address: ownerDetails.address || 'Unknown',
          contact: ownerDetails.contactNumber || 'Unknown',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return Response.json({ pets });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load pets.' }, { status: 500 });
  }
}
