import { databaseUrl, requireVerifiedAdmin } from '../utils';

type BreedRecord = {
  value?: string;
};

const normalizeBreeds = (data: Record<string, BreedRecord> | null) =>
  Object.values(data ?? {})
    .map((entry) => entry.value)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => a.localeCompare(b));

export async function GET(request: Request) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const [dogResponse, catResponse] = await Promise.all([
      fetch(`${databaseUrl}/catalogs/petBreeds/dogBreeds.json?auth=${encodeURIComponent(verified.idToken)}`, {
        cache: 'no-store',
      }),
      fetch(`${databaseUrl}/catalogs/petBreeds/catBreeds.json?auth=${encodeURIComponent(verified.idToken)}`, {
        cache: 'no-store',
      }),
    ]);

    if (!dogResponse.ok) {
      return Response.json({ error: 'Failed to load dog breeds.' }, { status: dogResponse.status });
    }

    if (!catResponse.ok) {
      return Response.json({ error: 'Failed to load cat breeds.' }, { status: catResponse.status });
    }

    const dogData = (await dogResponse.json()) as Record<string, BreedRecord> | null;
    const catData = (await catResponse.json()) as Record<string, BreedRecord> | null;

    return Response.json({
      dogBreeds: normalizeBreeds(dogData),
      catBreeds: normalizeBreeds(catData),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load adoption form data.' }, { status: 500 });
  }
}
