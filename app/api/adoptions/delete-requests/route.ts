import {
  databaseUrl,
  formatDateTime,
  requireVerifiedAdmin,
  type AdoptionDeleteRequestRecord,
  type AdoptedPetRecord,
  type ShelterPetRecord,
} from '../utils';
import { createActivityLog } from '@/lib/audit/activity-log';

type DeleteRequestPayload = {
  petId?: string;
  petName?: string;
  petStatus?: 'shelter' | 'adopted';
  requestedByUid?: string;
  requestedByName?: string;
  requestedByEmail?: string;
};

const getPetPath = (status?: 'shelter' | 'adopted') =>
  status === 'adopted' ? 'adoptedPets' : 'petShelterList';

export async function GET(request: Request) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    if (verified.session.role !== 'super_admin') {
      return Response.json({ error: 'Only super admins can view adoption delete requests.' }, { status: 403 });
    }

    const response = await fetch(
      `${databaseUrl}/adoptionDeleteRequests.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to load adoption delete requests.' }, { status: response.status });
    }

    const data = (await response.json()) as Record<string, AdoptionDeleteRequestRecord> | null;
    const requests = Object.entries(data ?? {})
      .filter(([, row]) => row.status === 'pending')
      .map(([id, row]) => ({
        id,
        petId: row.petId || '',
        petName: row.petName || 'Unknown pet',
        petStatus: row.petStatus === 'adopted' ? 'adopted' : 'shelter',
        requestedByUid: row.requestedByUid || '',
        requestedByName: row.requestedByName || 'Unknown admin',
        requestedByEmail: row.requestedByEmail || 'No email',
        status: row.status || 'pending',
        createdAt: formatDateTime(row.createdAt),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return Response.json({ requests });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load adoption delete requests.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    if (verified.session.role !== 'system_admin') {
      return Response.json({ error: 'Only system admins can request adoption deletion.' }, { status: 403 });
    }

    const body = (await request.json()) as DeleteRequestPayload;
    if (!body.petId || !body.petName) {
      return Response.json({ error: 'Pet information is required for a delete request.' }, { status: 400 });
    }

    const petStatus = body.petStatus === 'adopted' ? 'adopted' : 'shelter';
    const petPath = getPetPath(petStatus);
    const petResponse = await fetch(
      `${databaseUrl}/catalogs/${petPath}/${encodeURIComponent(body.petId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!petResponse.ok) {
      return Response.json({ error: 'Failed to validate adoption record.' }, { status: petResponse.status });
    }

    const petRecord = (await petResponse.json()) as ShelterPetRecord | AdoptedPetRecord | null;
    if (!petRecord) {
      return Response.json({ error: 'Adoption record not found.' }, { status: 404 });
    }

    if (petRecord.requestStatus === 'pending') {
      return Response.json({ error: 'A pending delete request already exists for this adoption record.' }, { status: 409 });
    }

    const payload: AdoptionDeleteRequestRecord = {
      petId: body.petId,
      petName: body.petName,
      petStatus,
      requestedByUid: body.requestedByUid || verified.session.uid,
      requestedByName: body.requestedByName || verified.session.name || 'System Admin',
      requestedByEmail: body.requestedByEmail || verified.session.email,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const requestResponse = await fetch(
      `${databaseUrl}/adoptionDeleteRequests.json?auth=${encodeURIComponent(verified.idToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    );

    if (!requestResponse.ok) {
      return Response.json({ error: 'Failed to create adoption delete request.' }, { status: requestResponse.status });
    }

    const createdRequest = (await requestResponse.json()) as { name?: string } | null;
    if (!createdRequest?.name) {
      return Response.json({ error: 'Delete request was created but its ID was not returned.' }, { status: 500 });
    }

    const statusResponse = await fetch(
      `${databaseUrl}/catalogs/${petPath}/${encodeURIComponent(body.petId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestStatus: 'pending',
          deleteRequestId: createdRequest.name,
          deleteRequestByUid: verified.session.uid,
        }),
        cache: 'no-store',
      }
    );

    if (!statusResponse.ok) {
      return Response.json({ error: 'Delete request was created but adoption status could not be updated.' }, { status: statusResponse.status });
    }

    await createActivityLog({
      session: verified.session,
      idToken: verified.idToken,
      log: {
        action: 'requested_delete',
        module: 'adoption',
        target: {
          type: petStatus === 'adopted' ? 'adopted_pet' : 'shelter_pet',
          id: body.petId,
          name: body.petName,
        },
        description: `${verified.session.name || verified.session.email} requested deletion of adoption record ${body.petName}.`,
        metadata: {
          requestId: createdRequest.name,
          petStatus,
        },
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create adoption delete request.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    if (verified.session.role !== 'system_admin') {
      return Response.json({ error: 'Only system admins can cancel adoption delete requests.' }, { status: 403 });
    }

    const body = (await request.json()) as { petId?: string; petStatus?: 'shelter' | 'adopted' };
    if (!body.petId) {
      return Response.json({ error: 'Pet ID is required to cancel a delete request.' }, { status: 400 });
    }

    const petStatus = body.petStatus === 'adopted' ? 'adopted' : 'shelter';
    const petPath = getPetPath(petStatus);
    const petResponse = await fetch(
      `${databaseUrl}/catalogs/${petPath}/${encodeURIComponent(body.petId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!petResponse.ok) {
      return Response.json({ error: 'Failed to validate adoption record.' }, { status: petResponse.status });
    }

    const petRecord = (await petResponse.json()) as ShelterPetRecord | AdoptedPetRecord | null;
    if (!petRecord || petRecord.requestStatus !== 'pending' || !petRecord.deleteRequestId) {
      return Response.json({ error: 'No cancellable pending delete request was found for this adoption record.' }, { status: 404 });
    }

    if (petRecord.deleteRequestByUid && petRecord.deleteRequestByUid !== verified.session.uid) {
      return Response.json({ error: 'You can only cancel your own pending adoption delete request.' }, { status: 403 });
    }

    const [deleteRequestResponse, clearStatusResponse] = await Promise.all([
      fetch(
        `${databaseUrl}/adoptionDeleteRequests/${encodeURIComponent(petRecord.deleteRequestId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
        { method: 'DELETE', cache: 'no-store' }
      ),
      fetch(
        `${databaseUrl}/catalogs/${petPath}/${encodeURIComponent(body.petId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestStatus: null,
            deleteRequestId: null,
            deleteRequestByUid: null,
          }),
          cache: 'no-store',
        }
      ),
    ]);

    if (!deleteRequestResponse.ok || !clearStatusResponse.ok) {
      return Response.json({ error: 'Failed to cancel adoption delete request.' }, { status: 500 });
    }

    await createActivityLog({
      session: verified.session,
      idToken: verified.idToken,
      log: {
        action: 'canceled_delete_request',
        module: 'adoption',
        target: {
          type: petStatus === 'adopted' ? 'adopted_pet' : 'shelter_pet',
          id: body.petId,
          name: petRecord.petName || 'No Name',
        },
        description: `${verified.session.name || verified.session.email} canceled the delete request for adoption record ${petRecord.petName || 'No Name'}.`,
        metadata: {
          requestId: petRecord.deleteRequestId,
          petStatus,
        },
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to cancel adoption delete request.' }, { status: 500 });
  }
}
