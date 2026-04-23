import {
  databaseUrl,
  normalizeAdoptedPet,
  normalizeShelterPet,
  requireVerifiedAdmin,
  type AdoptedPetRecord,
  type ShelterPetRecord,
} from '../utils';
import { createActivityLog } from '@/lib/audit/activity-log';
import { archiveDeletedRecord } from '@/lib/archive/trash';

type RouteContext = {
  params: Promise<{
    petId: string;
  }>;
};

type AdoptionPayload = {
  petName?: string;
  petAge?: string;
  type?: string;
  gender?: string;
  breed?: string;
  description?: string;
  profileURL?: string;
};

const toShelterPayload = (body: AdoptionPayload, existing?: ShelterPetRecord): ShelterPetRecord => ({
  ...existing,
  petName: body.petName?.trim() || 'No Name',
  petAge: body.petAge?.trim() || 'Unknown',
  type: body.type?.trim(),
  gender: body.gender?.trim(),
  breed: body.breed?.trim(),
  petDescription: body.description?.trim() || 'No Description',
  profileURL: body.profileURL?.trim() || '/Profile.webp',
});

const fieldChanged = (left?: string | number, right?: string | number) =>
  String(left ?? '').trim() !== String(right ?? '').trim();

const buildChangedFields = (previous: ShelterPetRecord, next: ShelterPetRecord) =>
  [
    { field: 'Name', from: previous.petName || 'No Name', to: next.petName || 'No Name' },
    { field: 'Age', from: previous.petAge || 'Unknown', to: next.petAge || 'Unknown' },
    { field: 'Type', from: previous.type || 'Unknown', to: next.type || 'Unknown' },
    { field: 'Gender', from: previous.gender || 'Unknown', to: next.gender || 'Unknown' },
    { field: 'Breed', from: previous.breed || 'Unknown', to: next.breed || 'Unknown' },
    { field: 'Description', from: previous.petDescription || 'No Description', to: next.petDescription || 'No Description' },
  ].filter((entry) => fieldChanged(entry.from, entry.to));

export async function GET(request: Request, context: RouteContext) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const { petId } = await context.params;
    const [shelterResponse, adoptedResponse] = await Promise.all([
      fetch(`${databaseUrl}/catalogs/petShelterList/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(verified.idToken)}`, {
        cache: 'no-store',
      }),
      fetch(`${databaseUrl}/catalogs/adoptedPets/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(verified.idToken)}`, {
        cache: 'no-store',
      }),
    ]);

    if (!shelterResponse.ok) {
      return Response.json({ error: 'Failed to load adoption pet.' }, { status: shelterResponse.status });
    }

    if (!adoptedResponse.ok) {
      return Response.json({ error: 'Failed to load adopted pet.' }, { status: adoptedResponse.status });
    }

    const shelterPet = (await shelterResponse.json()) as ShelterPetRecord | null;
    if (shelterPet) {
      return Response.json({ pet: normalizeShelterPet(petId, shelterPet) });
    }

    const adoptedPet = (await adoptedResponse.json()) as AdoptedPetRecord | null;
    if (adoptedPet) {
      return Response.json({ pet: normalizeAdoptedPet(petId, adoptedPet) });
    }

    return Response.json({ error: 'Adoption pet not found.' }, { status: 404 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load adoption pet.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const { petId } = await context.params;
    const existingResponse = await fetch(
      `${databaseUrl}/catalogs/petShelterList/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!existingResponse.ok) {
      return Response.json({ error: 'Failed to load adoption pet.' }, { status: existingResponse.status });
    }

    const existing = (await existingResponse.json()) as ShelterPetRecord | null;
    if (!existing) {
      return Response.json({ error: 'Only shelter pets can be edited.' }, { status: 404 });
    }

    const body = (await request.json()) as AdoptionPayload;
    const payload = toShelterPayload(body, existing);

    if (!payload.type || !payload.gender || !payload.breed) {
      return Response.json({ error: 'Type, gender, and breed are required.' }, { status: 400 });
    }

    const response = await fetch(
      `${databaseUrl}/catalogs/petShelterList/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to update adoption pet.' }, { status: response.status });
    }

    const changedFields = buildChangedFields(existing, payload);
    if (changedFields.length > 0) {
      const changesDescription = changedFields
        .map((entry) => `${entry.field} from ${entry.from} to ${entry.to}`)
        .join('; ');

      await createActivityLog({
        session: verified.session,
        idToken: verified.idToken,
        log: {
          action: 'updated_adoption_pet',
          module: 'adoption',
          target: {
            type: 'adoption_pet',
            id: petId,
            name: payload.petName || 'No Name',
          },
          description: `${verified.session.name || verified.session.email} updated ${payload.petName || 'No Name'}'s adoption record: ${changesDescription}.`,
          metadata: {
            changedFields,
          },
        },
      });
    }

    return Response.json({ pet: normalizeShelterPet(petId, payload) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update adoption pet.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    if (verified.session.role !== 'super_admin') {
      return Response.json({ error: 'Only the super admin can delete adoption records.' }, { status: 403 });
    }

    const { petId } = await context.params;
    const body = (await request.json().catch(() => null)) as { status?: 'shelter' | 'adopted' } | null;
    const path = body?.status === 'adopted' ? 'adoptedPets' : 'petShelterList';

    const existingResponse = await fetch(
      `${databaseUrl}/catalogs/${path}/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!existingResponse.ok) {
      return Response.json({ error: 'Failed to load adoption record before deletion.' }, { status: existingResponse.status });
    }

    const existing = (await existingResponse.json()) as ShelterPetRecord | AdoptedPetRecord | null;
    if (!existing) {
      return Response.json({ error: 'Adoption record not found.' }, { status: 404 });
    }

    await archiveDeletedRecord({
      idToken: verified.idToken,
      path: `${path}/${petId}`,
      record: existing as Record<string, unknown>,
    });

    const response = await fetch(
      `${databaseUrl}/catalogs/${path}/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
      {
        method: 'DELETE',
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to delete adoption record.' }, { status: response.status });
    }

    if (existing.requestStatus === 'pending' && existing.deleteRequestId) {
      const requestCleanupResponse = await fetch(
        `${databaseUrl}/adoptionDeleteRequests/${encodeURIComponent(existing.deleteRequestId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
        {
          method: 'DELETE',
          cache: 'no-store',
        }
      );

      if (!requestCleanupResponse.ok) {
        console.warn('Failed to clean up adoption delete request.', requestCleanupResponse.status);
      }
    }

    await createActivityLog({
      session: verified.session,
      idToken: verified.idToken,
      log: {
        action: 'deleted_adoption_pet',
        module: 'adoption',
        target: {
          type: path === 'adoptedPets' ? 'adopted_pet' : 'shelter_pet',
          id: petId,
          name: existing.petName || 'No Name',
        },
        description: `${verified.session.name || verified.session.email} directly deleted ${existing.petName || 'No Name'} from ${path === 'adoptedPets' ? 'adopted pets' : 'shelter pets'}.`,
        metadata: {
          petStatus: path === 'adoptedPets' ? 'adopted' : 'shelter',
          deletedPendingRequestId: existing.requestStatus === 'pending' ? existing.deleteRequestId : null,
        },
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete adoption record.' }, { status: 500 });
  }
}
