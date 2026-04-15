import {
  databaseUrl,
  formatDateTime,
  asShelterPetRecord,
  getAddress,
  getUserFullName,
  requireVerifiedAdmin,
  type AdoptedPetRecord,
  type ShelterPetRecord,
  type UserRecord,
} from '../../utils';
import { createActivityLog } from '@/lib/audit/activity-log';

type RouteContext = {
  params: Promise<{
    petId: string;
  }>;
};

type RequestRecord = {
  userID?: string;
  userId?: string;
  uid?: string;
  requestedAt?: string;
  status?: string;
};

const normalizeRequestRecord = (id: string, value: unknown): RequestRecord => {
  if (typeof value === 'string') {
    return {
      userID: value,
    };
  }

  if (!value || typeof value !== 'object') {
    return {
      userID: id,
    };
  }

  return value as RequestRecord;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const { petId } = await context.params;
    const petResponse = await fetch(
      `${databaseUrl}/catalogs/petShelterList/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!petResponse.ok) {
      return Response.json({ error: 'Failed to load adoption requests.' }, { status: petResponse.status });
    }

    const pet = asShelterPetRecord(await petResponse.json());
    const requestNode = pet?.request;
    const entries =
      requestNode && typeof requestNode === 'object' && !Array.isArray(requestNode)
        ? Object.entries(requestNode)
        : [];

    const normalizedEntries = entries
      .map(([id, requestRecord]) => {
        const requestData = normalizeRequestRecord(id, requestRecord);
        const userId = requestData.userID || requestData.userId || requestData.uid || id;

        return { id, requestData, userId };
      })
      .filter(({ requestData, userId }) => {
        const hasExplicitUserId = Boolean(requestData.userID || requestData.userId || requestData.uid);
        const looksLikePlaceholder = userId === 'userID' || userId === 'userId' || userId === 'uid';

        return hasExplicitUserId && !looksLikePlaceholder;
      });

    const requestResults = await Promise.all(
      normalizedEntries.map(async ({ id, requestData, userId }) => {
        const userResponse = await fetch(
          `${databaseUrl}/users/${encodeURIComponent(userId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
          { cache: 'no-store' }
        );
        const user = userResponse.ok ? ((await userResponse.json()) as UserRecord | null) : null;

        return {
          id,
          userId,
          requesterName: user ? getUserFullName(user) : userId,
          requesterEmail: user?.email || 'No email',
          requesterContact: user?.contactNumber || 'No contact',
          requestedAt: formatDateTime(requestData.requestedAt),
          status: requestData.status || 'pending',
        };
      })
    );
    const requests = requestResults.filter((row): row is NonNullable<typeof row> => Boolean(row));

    return Response.json({ requests });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load adoption requests.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const { petId } = await context.params;
    const { requestId, userId, action } = (await request.json()) as {
      requestId?: string;
      userId?: string;
      action?: 'accept' | 'reject';
    };

    if (!requestId || !userId || (action !== 'accept' && action !== 'reject')) {
      return Response.json({ error: 'Request id, user id, and action are required.' }, { status: 400 });
    }

    const [petResponse, userResponse] = await Promise.all([
      fetch(`${databaseUrl}/catalogs/petShelterList/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(verified.idToken)}`, {
        cache: 'no-store',
      }),
      fetch(`${databaseUrl}/users/${encodeURIComponent(userId)}.json?auth=${encodeURIComponent(verified.idToken)}`, {
        cache: 'no-store',
      }),
    ]);

    if (!petResponse.ok) {
      return Response.json({ error: 'Failed to load adoption pet.' }, { status: petResponse.status });
    }

    const pet = (await petResponse.json()) as ShelterPetRecord | null;
    if (!pet) {
      return Response.json({ error: 'Adoption pet not found.' }, { status: 404 });
    }

    const user = userResponse.ok ? ((await userResponse.json()) as UserRecord | null) : null;

    if (action === 'accept') {
      const adoptedPet: AdoptedPetRecord = {
        ...pet,
        adoptedBy: userId,
        adoptedAt: new Date().toISOString(),
        status: 'Adopted',
        adopterDetails: {
          fullname: getUserFullName(user),
          contact: user?.contactNumber || 'Unknown',
          address: getAddress(user?.address),
          email: user?.email || 'Unknown',
        },
        request: {
          [requestId]: {
            ...(pet.request?.[requestId] ?? {}),
            userID: userId,
            status: 'Accepted',
          },
        },
      };

      const [adoptResponse, removeShelterResponse] = await Promise.all([
        fetch(`${databaseUrl}/catalogs/adoptedPets/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(verified.idToken)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(adoptedPet),
          cache: 'no-store',
        }),
        fetch(`${databaseUrl}/catalogs/petShelterList/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(verified.idToken)}`, {
          method: 'DELETE',
          cache: 'no-store',
        }),
      ]);

      if (!adoptResponse.ok || !removeShelterResponse.ok) {
        return Response.json({ error: 'Failed to accept adoption request.' }, { status: 500 });
      }

      await createActivityLog({
        session: verified.session,
        idToken: verified.idToken,
        log: {
          action: 'accepted_adoption_request',
          module: 'adoption',
          subject: {
            type: 'user',
            id: userId,
            name: getUserFullName(user),
          },
          target: {
            type: 'adoption_pet',
            id: petId,
            name: pet.petName || 'No Name',
          },
          description: `${verified.session.name || verified.session.email} accepted ${getUserFullName(user)}'s adoption request for ${pet.petName || 'No Name'}.`,
          metadata: {
            requestId,
            requesterEmail: user?.email,
          },
        },
      });

      return Response.json({ ok: true });
    }

    const rejectedPayload = {
      ...pet,
      request: undefined,
      rejectedAt: new Date().toISOString(),
      rejectedRequests: {
        [requestId]: {
          status: 'Rejected',
          userID: userId,
          rejectedAt: new Date().toISOString(),
          fullname: getUserFullName(user),
        },
      },
    };

    const [rejectArchiveResponse, removeRequestResponse] = await Promise.all([
      fetch(`${databaseUrl}/catalogs/rejectedUser/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(verified.idToken)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rejectedPayload),
        cache: 'no-store',
      }),
      fetch(`${databaseUrl}/catalogs/petShelterList/${encodeURIComponent(petId)}/request/${encodeURIComponent(requestId)}.json?auth=${encodeURIComponent(verified.idToken)}`, {
        method: 'DELETE',
        cache: 'no-store',
      }),
    ]);

    if (!rejectArchiveResponse.ok || !removeRequestResponse.ok) {
      return Response.json({ error: 'Failed to reject adoption request.' }, { status: 500 });
    }

    await createActivityLog({
      session: verified.session,
      idToken: verified.idToken,
      log: {
        action: 'rejected_adoption_request',
        module: 'adoption',
        subject: {
          type: 'user',
          id: userId,
          name: getUserFullName(user),
        },
        target: {
          type: 'adoption_pet',
          id: petId,
          name: pet.petName || 'No Name',
        },
        description: `${verified.session.name || verified.session.email} rejected ${getUserFullName(user)}'s adoption request for ${pet.petName || 'No Name'}.`,
        metadata: {
          requestId,
          requesterEmail: user?.email,
        },
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update adoption request.' }, { status: 500 });
  }
}
