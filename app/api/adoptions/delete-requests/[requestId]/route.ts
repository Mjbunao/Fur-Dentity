import { databaseUrl, requireVerifiedAdmin, type AdoptionDeleteRequestRecord } from '../../utils';
import { createActivityLog } from '@/lib/audit/activity-log';
import { createAdminNotification } from '@/lib/notifications/admin-notification';

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

const getPetPath = (status?: 'shelter' | 'adopted') =>
  status === 'adopted' ? 'adoptedPets' : 'petShelterList';

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    if (verified.session.role !== 'super_admin') {
      return Response.json({ error: 'Only super admins can resolve adoption delete requests.' }, { status: 403 });
    }

    const { action } = (await request.json()) as { action?: 'approve' | 'reject' };
    if (action !== 'approve' && action !== 'reject') {
      return Response.json({ error: 'Action must be approve or reject.' }, { status: 400 });
    }

    const { requestId } = await context.params;
    const requestResponse = await fetch(
      `${databaseUrl}/adoptionDeleteRequests/${encodeURIComponent(requestId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!requestResponse.ok) {
      return Response.json({ error: 'Failed to load adoption delete request.' }, { status: requestResponse.status });
    }

    const requestRecord = (await requestResponse.json()) as AdoptionDeleteRequestRecord | null;
    if (!requestRecord?.petId) {
      return Response.json({ error: 'Adoption delete request not found.' }, { status: 404 });
    }

    const petPath = getPetPath(requestRecord.petStatus);

    if (action === 'approve') {
      const deletePetResponse = await fetch(
        `${databaseUrl}/catalogs/${petPath}/${encodeURIComponent(requestRecord.petId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
        {
          method: 'DELETE',
          cache: 'no-store',
        }
      );

      if (!deletePetResponse.ok) {
        return Response.json({ error: 'Failed to delete adoption record.' }, { status: deletePetResponse.status });
      }
    } else {
      const resetStatusResponse = await fetch(
        `${databaseUrl}/catalogs/${petPath}/${encodeURIComponent(requestRecord.petId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestStatus: 'rejected',
            deleteRequestId: null,
            deleteRequestByUid: null,
          }),
          cache: 'no-store',
        }
      );

      if (!resetStatusResponse.ok) {
        return Response.json({ error: 'Failed to update adoption request status.' }, { status: resetStatusResponse.status });
      }
    }

    const deleteRequestResponse = await fetch(
      `${databaseUrl}/adoptionDeleteRequests/${encodeURIComponent(requestId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
      {
        method: 'DELETE',
        cache: 'no-store',
      }
    );

    if (!deleteRequestResponse.ok) {
      return Response.json({ error: 'Failed to remove adoption delete request.' }, { status: deleteRequestResponse.status });
    }

    await createActivityLog({
      session: verified.session,
      idToken: verified.idToken,
      log: {
        action: action === 'approve' ? 'approved_delete_request' : 'rejected_delete_request',
        module: 'adoption',
        subject: {
          type: 'admin',
          id: requestRecord.requestedByUid,
          name: requestRecord.requestedByName,
        },
        target: {
          type: requestRecord.petStatus === 'adopted' ? 'adopted_pet' : 'shelter_pet',
          id: requestRecord.petId,
          name: requestRecord.petName || 'Unknown pet',
        },
        description:
          action === 'approve'
            ? `${verified.session.name || verified.session.email} approved the delete request and removed adoption record ${requestRecord.petName || 'Unknown pet'}.`
            : `${verified.session.name || verified.session.email} rejected the delete request for adoption record ${requestRecord.petName || 'Unknown pet'}.`,
        metadata: {
          requestId,
          petStatus: requestRecord.petStatus,
          requestedByEmail: requestRecord.requestedByEmail,
        },
      },
    });

    await createAdminNotification({
      uid: requestRecord.requestedByUid,
      idToken: verified.idToken,
      notification: {
        type: 'delete_request_resolved',
        title:
          action === 'approve'
            ? 'Your adoption delete request was approved'
            : 'Your adoption delete request was rejected',
        description:
          action === 'approve'
            ? `${verified.session.name || verified.session.email} approved your delete request for ${requestRecord.petName || 'Unknown pet'}.`
            : `${verified.session.name || verified.session.email} rejected your delete request for ${requestRecord.petName || 'Unknown pet'}.`,
        href:
          action === 'approve'
            ? '/adoption'
            : `/adoption/${encodeURIComponent(requestRecord.petId)}`,
        read: true,
      },
    });

    await createAdminNotification({
      uid: verified.session.uid,
      idToken: verified.idToken,
      notification: {
        type: 'delete_request_resolved',
        title: `${requestRecord.requestedByName || 'System Admin'} requested adoption deletion`,
        description: `${requestRecord.petName || 'Unknown pet'} - Request ${action === 'approve' ? 'approved' : 'rejected'}`,
        href:
          action === 'approve'
            ? '/adoption'
            : `/adoption/${encodeURIComponent(requestRecord.petId)}`,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to resolve adoption delete request.' }, { status: 500 });
  }
}
