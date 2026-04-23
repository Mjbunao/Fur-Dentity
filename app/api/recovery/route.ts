import { firebaseConfig } from '@/lib/firebase-config';
import {
  formatRecoveredModule,
  getRecordName,
  requireVerifiedSuperAdmin,
  type ArchivedRecord,
  type RecoveryModule,
} from './utils';

type RecoveryRow = {
  id: string;
  module: RecoveryModule;
  moduleLabel: string;
  name: string;
  deletedAt: string;
  archivePath: string;
  restorePath: string;
  reportMainDir?: string;
  reportSubDir?: string;
};

const archiveUrl = firebaseConfig.databaseURL;

const fetchArchive = async (path: string, idToken: string) => {
  const response = await fetch(`${archiveUrl}/deleted/${path}.json?auth=${encodeURIComponent(idToken)}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    console.warn(`Failed to load archive path deleted/${path}.`, response.status);
    return null;
  }

  return response.json() as Promise<unknown>;
};

const asRecordMap = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const toSimpleRows = ({
  module,
  rows,
}: {
  module: Exclude<RecoveryModule, 'reports'>;
  rows: unknown;
}): RecoveryRow[] =>
  Object.entries(asRecordMap(rows)).map(([id, value]) => {
    const record = asRecordMap(value) as ArchivedRecord;

    return {
      id,
      module,
      moduleLabel: formatRecoveredModule(module),
      name: getRecordName(module, record, id),
      deletedAt: record.deletedAt || '',
      archivePath: `${module}/${id}`,
      restorePath:
        module === 'donation'
          ? `donations/${id}`
          : module === 'petShelterList'
            ? `catalogs/petShelterList/${id}`
            : module === 'adoptedPets'
              ? `catalogs/adoptedPets/${id}`
              : `${module}/${id}`,
    };
  });

const toReportRows = (reports: unknown): RecoveryRow[] => {
  const rows: RecoveryRow[] = [];

  for (const [mainDir, mainValue] of Object.entries(asRecordMap(reports))) {
    for (const [subDir, subValue] of Object.entries(asRecordMap(mainValue))) {
      for (const [reportId, reportValue] of Object.entries(asRecordMap(subValue))) {
        const record = asRecordMap(reportValue) as ArchivedRecord;

        rows.push({
          id: reportId,
          module: 'reports',
          moduleLabel: 'Report',
          name: getRecordName('reports', record, reportId),
          deletedAt: record.deletedAt || '',
          archivePath: `reports/${mainDir}/${subDir}/${reportId}`,
          restorePath: `tickets/${mainDir}/${subDir}/${reportId}`,
          reportMainDir: mainDir,
          reportSubDir: subDir,
        });
      }
    }
  }

  return rows;
};

export async function GET(request: Request) {
  try {
    const verified = await requireVerifiedSuperAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const [admins, users, pets, donations, shelterPets, adoptedPets, reports] = await Promise.all([
      fetchArchive('admins', verified.idToken),
      fetchArchive('users', verified.idToken),
      fetchArchive('pets', verified.idToken),
      fetchArchive('donation', verified.idToken),
      fetchArchive('petShelterList', verified.idToken),
      fetchArchive('adoptedPets', verified.idToken),
      fetchArchive('reports', verified.idToken),
    ]);

    const records = [
      ...toSimpleRows({ module: 'admins', rows: admins }),
      ...toSimpleRows({ module: 'users', rows: users }),
      ...toSimpleRows({ module: 'pets', rows: pets }),
      ...toSimpleRows({ module: 'donation', rows: donations }),
      ...toSimpleRows({ module: 'petShelterList', rows: shelterPets }),
      ...toSimpleRows({ module: 'adoptedPets', rows: adoptedPets }),
      ...toReportRows(reports),
    ].sort((left, right) => {
      const leftTime = left.deletedAt ? new Date(left.deletedAt).getTime() : 0;
      const rightTime = right.deletedAt ? new Date(right.deletedAt).getTime() : 0;

      return rightTime - leftTime;
    });

    return Response.json({ records });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load recovery records.' }, { status: 500 });
  }
}
