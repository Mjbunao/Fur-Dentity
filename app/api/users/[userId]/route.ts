import { requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';
import { createActivityLog } from '@/lib/audit/activity-log';
import { archiveDeletedRecord } from '@/lib/archive/trash';

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

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

const getUserName = (user: LegacyUserRecord | null | undefined) => {
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  return fullName || 'No name';
};

type LegacyPetRecord = {
  petDetails?: {
    petName?: string;
    petType?: string;
    breed?: string;
    age?: string | number;
    image?: string;
    colors?: Record<string, string>;
    petColors?: Record<string, string>;
    color?: Record<string, string>;
  };
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

async function getAuthorizedRequestContext(request: Request) {
  const session = await requireSession();
  const idToken = getIdTokenFromRequest(request);

  if (!idToken) {
    return { error: Response.json({ error: 'Missing Firebase token.' }, { status: 401 }) };
  }

  const authUser = await verifyFirebaseIdToken(idToken);

  if (!authUser || authUser.uid !== session.uid) {
    return { error: Response.json({ error: 'Invalid Firebase session.' }, { status: 401 }) };
  }

  return { session, idToken };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const authContext = await getAuthorizedRequestContext(request);

    if ('error' in authContext) {
      return authContext.error;
    }

    const { userId } = await context.params;
    const [userResponse, petsResponse] = await Promise.all([
      fetch(
        `${firebaseConfig.databaseURL}/users/${encodeURIComponent(userId)}.json?auth=${encodeURIComponent(authContext.idToken)}`,
        { cache: 'no-store' }
      ),
      fetch(`${firebaseConfig.databaseURL}/pets.json?auth=${encodeURIComponent(authContext.idToken)}`, {
        cache: 'no-store',
      }),
    ]);

    if (!userResponse.ok) {
      return Response.json({ error: 'Failed to load user details.' }, { status: userResponse.status });
    }

    if (!petsResponse.ok) {
      return Response.json({ error: 'Failed to load user pets.' }, { status: petsResponse.status });
    }

    const user = (await userResponse.json()) as LegacyUserRecord | null;

    if (!user) {
      return Response.json({ error: 'User not found.' }, { status: 404 });
    }

    const petsData = (await petsResponse.json()) as Record<string, LegacyPetRecord> | null;
    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim().toLowerCase();

    const pets = Object.entries(petsData ?? {})
      .filter(([, pet]) => pet.ownerDetails?.fullName?.trim().toLowerCase() === fullName)
      .map(([id, pet]) => {
        const petDetails = pet.petDetails ?? {};
        const colorMap =
          petDetails.colors ??
          petDetails.petColors ??
          petDetails.color ??
          {};

        return {
          id,
          name: petDetails.petName || 'Unnamed pet',
          type: petDetails.petType || 'Unknown',
          breed: petDetails.breed || 'Unknown',
          age: petDetails.age ? String(petDetails.age) : 'N/A',
          image: petDetails.image || '/Profile.webp',
          colors: Object.values(colorMap).filter(Boolean),
        };
      });

    return Response.json({
      user: {
        id: userId,
        name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'No name',
        email: user.email || 'No email',
        contact: user.contactNumber || 'No contact',
        address: user.address?.fullAddress || 'No address',
        profilePic: user.profilePic || '/Profile.webp',
      },
      pets,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load user details.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const authContext = await getAuthorizedRequestContext(request);

    if ('error' in authContext) {
      return authContext.error;
    }

    if (authContext.session.role !== 'super_admin') {
      return Response.json({ error: 'Only the super admin can delete users.' }, { status: 403 });
    }

    const { userId } = await context.params;
    const userResponse = await fetch(
      `${firebaseConfig.databaseURL}/users/${encodeURIComponent(userId)}.json?auth=${encodeURIComponent(authContext.idToken)}`,
      { cache: 'no-store' }
    );

    if (!userResponse.ok) {
      return Response.json({ error: 'Failed to load user before deletion.' }, { status: userResponse.status });
    }

    const userRecord = (await userResponse.json()) as LegacyUserRecord | null;
    if (!userRecord) {
      return Response.json({ error: 'User not found.' }, { status: 404 });
    }

    await archiveDeletedRecord({
      idToken: authContext.idToken,
      path: `users/${userId}`,
      record: userRecord as Record<string, unknown>,
    });

    const response = await fetch(
      `${firebaseConfig.databaseURL}/users/${encodeURIComponent(userId)}.json?auth=${encodeURIComponent(authContext.idToken)}`,
      {
        method: 'DELETE',
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to delete user.' }, { status: response.status });
    }

    await createActivityLog({
      session: authContext.session,
      idToken: authContext.idToken,
      log: {
        action: 'deleted_user',
        module: 'users',
        subject: {
          type: 'user',
          id: userId,
          name: getUserName(userRecord),
        },
        target: {
          type: 'user',
          id: userId,
          name: getUserName(userRecord),
        },
        description: `${authContext.session.name || authContext.session.email} directly deleted user ${getUserName(userRecord)}.`,
        metadata: {
          email: userRecord.email,
          contactNumber: userRecord.contactNumber,
        },
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete user.' }, { status: 500 });
  }
}
