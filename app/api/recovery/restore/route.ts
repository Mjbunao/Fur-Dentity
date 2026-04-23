import { createActivityLog } from '@/lib/audit/activity-log';
import { getArchiveRecord, restoreArchivedRecord } from '@/lib/archive/trash';
import {
  formatRecoveredModule,
  getRecoveryPaths,
  getRecordName,
  requireVerifiedSuperAdmin,
  sanitizeRestoredRecord,
  type ArchivedRecord,
  type RecoveryModule,
} from '../utils';

type RestorePayload = {
  module?: RecoveryModule;
  id?: string;
  reportMainDir?: string;
  reportSubDir?: string;
};

export async function POST(request: Request) {
  try {
    const verified = await requireVerifiedSuperAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const body = (await request.json().catch(() => null)) as RestorePayload | null;
    const module = body?.module;
    const id = body?.id?.trim();

    if (
      !module ||
      !id ||
      !['admins', 'users', 'pets', 'donation', 'petShelterList', 'adoptedPets', 'reports'].includes(module)
    ) {
      return Response.json({ error: 'Invalid recovery record.' }, { status: 400 });
    }

    const paths = getRecoveryPaths({
      module,
      id,
      reportMainDir: body?.reportMainDir,
      reportSubDir: body?.reportSubDir,
    });

    if (!paths) {
      return Response.json({ error: 'Invalid recovery path.' }, { status: 400 });
    }

    const archivedRecord = await getArchiveRecord<ArchivedRecord>({
      idToken: verified.idToken,
      path: paths.archivePath,
    });

    if (!archivedRecord) {
      return Response.json({ error: 'Archived record not found.' }, { status: 404 });
    }

    const restoredRecord = sanitizeRestoredRecord(archivedRecord);

    await restoreArchivedRecord({
      idToken: verified.idToken,
      archivePath: paths.archivePath,
      restorePath: paths.restorePath,
      record: restoredRecord,
    });

    const moduleLabel = formatRecoveredModule(module);
    const recordName = getRecordName(module, archivedRecord, id);

    await createActivityLog({
      session: verified.session,
      idToken: verified.idToken,
      log: {
        action: 'restored_record',
        module: 'recovery',
        target: {
          type: module,
          id,
          name: recordName,
        },
        description: `${verified.session.name || verified.session.email} restored ${recordName} from ${moduleLabel} recovery.`,
        metadata: {
          archivePath: paths.archivePath,
          restorePath: paths.restorePath,
          deletedAt: archivedRecord.deletedAt,
        },
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to restore archived record.' }, { status: 500 });
  }
}
