import {
  databaseUrl,
  asAdoptedPetRecord,
  asShelterPetRecord,
  normalizeAdoptedPet,
  normalizeShelterPet,
  requireVerifiedAdmin,
  type ShelterPetRecord,
} from './utils';
import { createActivityLog } from '@/lib/audit/activity-log';

type AdoptionPayload = {
  petName?: string;
  petAge?: string;
  type?: string;
  gender?: string;
  breed?: string;
  description?: string;
  profileURL?: string;
};

const toShelterPayload = (body: AdoptionPayload): ShelterPetRecord => ({
  petName: body.petName?.trim() || 'No Name',
  petAge: body.petAge?.trim() || 'Unknown',
  type: body.type?.trim(),
  gender: body.gender?.trim(),
  breed: body.breed?.trim(),
  petDescription: body.description?.trim() || 'No Description',
  profileURL: body.profileURL?.trim() || '/Profile.webp',
});

export async function GET(request: Request) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const [shelterResponse, adoptedResponse] = await Promise.all([
      fetch(`${databaseUrl}/catalogs/petShelterList.json?auth=${encodeURIComponent(verified.idToken)}`, {
        cache: 'no-store',
      }),
      fetch(`${databaseUrl}/catalogs/adoptedPets.json?auth=${encodeURIComponent(verified.idToken)}`, {
        cache: 'no-store',
      }),
    ]);

    if (!shelterResponse.ok) {
      return Response.json({ error: 'Failed to load shelter pets.' }, { status: shelterResponse.status });
    }

    if (!adoptedResponse.ok) {
      return Response.json({ error: 'Failed to load adopted pets.' }, { status: adoptedResponse.status });
    }

    const shelterData = (await shelterResponse.json()) as Record<string, unknown> | null;
    const adoptedData = (await adoptedResponse.json()) as Record<string, unknown> | null;

    const shelterPets = Object.entries(shelterData ?? {})
      .flatMap(([id, pet]) => {
        const normalizedPet = asShelterPetRecord(pet);
        return normalizedPet ? [normalizeShelterPet(id, normalizedPet)] : [];
      })
      .sort((a, b) => a.petName.localeCompare(b.petName));

    const adoptedPets = Object.entries(adoptedData ?? {})
      .flatMap(([id, pet]) => {
        const normalizedPet = asAdoptedPetRecord(pet);
        return normalizedPet ? [normalizeAdoptedPet(id, normalizedPet)] : [];
      })
      .sort((a, b) => a.petName.localeCompare(b.petName));

    return Response.json({ shelterPets, adoptedPets });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load adoption records.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const body = (await request.json()) as AdoptionPayload;
    const payload = toShelterPayload(body);

    if (!payload.type || !payload.gender || !payload.breed) {
      return Response.json({ error: 'Type, gender, and breed are required.' }, { status: 400 });
    }

    const response = await fetch(
      `${databaseUrl}/catalogs/petShelterList.json?auth=${encodeURIComponent(verified.idToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to create adoption pet.' }, { status: response.status });
    }

    const data = (await response.json()) as { name?: string };
    if (!data.name) {
      return Response.json({ error: 'Adoption pet key was not created.' }, { status: 500 });
    }

    await createActivityLog({
      session: verified.session,
      idToken: verified.idToken,
      log: {
        action: 'created_adoption_pet',
        module: 'adoption',
        target: {
          type: 'adoption_pet',
          id: data.name,
          name: payload.petName || 'No Name',
        },
        description: `${verified.session.name || verified.session.email} added ${payload.petName || 'No Name'} to the adoption shelter list.`,
        metadata: {
          petName: payload.petName,
          type: payload.type,
          gender: payload.gender,
          breed: payload.breed,
        },
      },
    });

    return Response.json({ pet: normalizeShelterPet(data.name, payload) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create adoption pet.' }, { status: 500 });
  }
}
