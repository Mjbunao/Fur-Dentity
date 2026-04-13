import {
  databaseUrl,
  normalizeAdoptedPet,
  normalizeShelterPet,
  requireVerifiedAdmin,
  type AdoptedPetRecord,
  type ShelterPetRecord,
} from '../utils';

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

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete adoption record.' }, { status: 500 });
  }
}
