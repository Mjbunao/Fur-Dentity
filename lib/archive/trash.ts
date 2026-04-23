import { firebaseConfig } from '@/lib/firebase-config';

type ArchiveRecord = Record<string, unknown>;

const databaseUrl = firebaseConfig.databaseURL;

export const getArchiveRecord = async <T,>({
  idToken,
  path,
}: {
  idToken: string;
  path: string;
}) => {
  const response = await fetch(
    `${databaseUrl}/deleted/${path}.json?auth=${encodeURIComponent(idToken)}`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    throw new Error(`Failed to load archived record at deleted/${path}.`);
  }

  return response.json() as Promise<T | null>;
};

export const restoreArchivedRecord = async ({
  idToken,
  archivePath,
  restorePath,
  record,
}: {
  idToken: string;
  archivePath: string;
  restorePath: string;
  record: ArchiveRecord;
}) => {
  const restoreResponse = await fetch(
    `${firebaseConfig.databaseURL}/${restorePath}.json?auth=${encodeURIComponent(idToken)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
      cache: 'no-store',
    }
  );

  if (!restoreResponse.ok) {
    throw new Error(`Failed to restore record to ${restorePath}.`);
  }

  const archiveDeleteResponse = await fetch(
    `${databaseUrl}/deleted/${archivePath}.json?auth=${encodeURIComponent(idToken)}`,
    {
      method: 'DELETE',
      cache: 'no-store',
    }
  );

  if (!archiveDeleteResponse.ok) {
    throw new Error(`Record restored, but failed to remove deleted/${archivePath}.`);
  }
};

export const hardDeleteArchivedRecord = async ({
  idToken,
  archivePath,
}: {
  idToken: string;
  archivePath: string;
}) => {
  const response = await fetch(
    `${databaseUrl}/deleted/${archivePath}.json?auth=${encodeURIComponent(idToken)}`,
    {
      method: 'DELETE',
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to permanently delete deleted/${archivePath}.`);
  }
};

export const archiveDeletedRecord = async ({
  idToken,
  path,
  record,
}: {
  idToken: string;
  path: string;
  record: ArchiveRecord;
}) => {
  const response = await fetch(
    `${databaseUrl}/deleted/${path}.json?auth=${encodeURIComponent(idToken)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...record,
        deletedAt: new Date().toISOString(),
      }),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to archive deleted record at deleted/${path}.`);
  }
};
