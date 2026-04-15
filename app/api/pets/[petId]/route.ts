import { requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';
import { createActivityLog } from '@/lib/audit/activity-log';

type RouteContext = {
  params: Promise<{
    petId: string;
  }>;
};

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

const getPetName = (pet: LegacyPetRecord | null | undefined) => pet?.petDetails?.petName || 'Unknown pet';
const getOwnerName = (pet: LegacyPetRecord | null | undefined) => pet?.ownerDetails?.fullName || 'Unknown owner';

const getIdTokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
};

export async function GET(request: Request, context: RouteContext) {
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

    const { petId } = await context.params;
    const response = await fetch(
      `${firebaseConfig.databaseURL}/pets/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to load pet details.' }, { status: response.status });
    }

    const pet = (await response.json()) as LegacyPetRecord | null;

    if (!pet) {
      return Response.json({ error: 'Pet not found.' }, { status: 404 });
    }

    const petDetails = pet.petDetails ?? {};
    const ownerDetails = pet.ownerDetails ?? {};
    const colorMap =
      petDetails.colors ??
      petDetails.petColors ??
      petDetails.color ??
      {};

    return Response.json({
      pet: {
        id: petId,
        name: petDetails.petName || 'Unknown',
        type: petDetails.petType || 'Unknown',
        breed: petDetails.breed || 'Unknown',
        birthdate: petDetails.birthdate || 'Unknown',
        image: petDetails.image || '/Profile.webp',
        owner: ownerDetails.fullName || 'Unknown',
        address: ownerDetails.address || 'Unknown',
        contact: ownerDetails.contactNumber || 'Unknown',
        colors: Object.values(colorMap).filter(Boolean),
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load pet details.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
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

    if (session.role !== 'super_admin') {
      return Response.json({ error: 'Only the super admin can delete pets.' }, { status: 403 });
    }

    const { petId } = await context.params;
    const petResponse = await fetch(
      `${firebaseConfig.databaseURL}/pets/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );

    if (!petResponse.ok) {
      return Response.json({ error: 'Failed to load pet before deletion.' }, { status: petResponse.status });
    }

    const petRecord = (await petResponse.json()) as LegacyPetRecord | null;
    if (!petRecord) {
      return Response.json({ error: 'Pet not found.' }, { status: 404 });
    }

    const response = await fetch(
      `${firebaseConfig.databaseURL}/pets/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(idToken)}`,
      {
        method: 'DELETE',
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to delete pet.' }, { status: response.status });
    }

    await createActivityLog({
      session,
      idToken,
      log: {
        action: 'deleted_pet',
        module: 'pets',
        subject: {
          type: 'user',
          name: getOwnerName(petRecord),
        },
        target: {
          type: 'pet',
          id: petId,
          name: getPetName(petRecord),
        },
        description: `${session.name || session.email} directly deleted ${getOwnerName(petRecord)}'s pet record for ${getPetName(petRecord)}.`,
        metadata: {
          petType: petRecord.petDetails?.petType,
          breed: petRecord.petDetails?.breed,
          ownerName: getOwnerName(petRecord),
          contactNumber: petRecord.ownerDetails?.contactNumber,
        },
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete pet.' }, { status: 500 });
  }
}
