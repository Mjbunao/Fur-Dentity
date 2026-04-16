import { requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';
import { createActivityLog } from '@/lib/audit/activity-log';
import { createAdminNotification } from '@/lib/notifications/admin-notification';

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

type DeleteRequestRecord = {
  donationId?: string;
  donationName?: string;
  requestedByUid?: string;
  requestedByName?: string;
  requestedByEmail?: string;
  status?: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
  resolvedAt?: string;
  resolvedByUid?: string;
};

type DonationRecord = {
  donorType?: string;
  userId?: string;
  name?: string;
  amount?: number;
  platform?: string;
};

const getIdTokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }
  return authorization.slice('Bearer '.length).trim();
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    if (session.role !== 'super_admin') {
      return Response.json({ error: 'Only super admins can resolve delete requests.' }, { status: 403 });
    }

    const idToken = getIdTokenFromRequest(request);
    if (!idToken) {
      return Response.json({ error: 'Missing Firebase token.' }, { status: 401 });
    }

    const authUser = await verifyFirebaseIdToken(idToken);
    if (!authUser || authUser.uid !== session.uid) {
      return Response.json({ error: 'Invalid Firebase session.' }, { status: 401 });
    }

    const { action } = (await request.json()) as { action?: 'approve' | 'reject' };
    if (action !== 'approve' && action !== 'reject') {
      return Response.json({ error: 'Action must be approve or reject.' }, { status: 400 });
    }

    const { requestId } = await context.params;
    const requestResponse = await fetch(
      `${firebaseConfig.databaseURL}/donationDeleteRequests/${encodeURIComponent(requestId)}.json?auth=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );

    if (!requestResponse.ok) {
      return Response.json({ error: 'Failed to load the delete request.' }, { status: requestResponse.status });
    }

    const requestRecord = (await requestResponse.json()) as DeleteRequestRecord | null;
    if (!requestRecord?.donationId) {
      return Response.json({ error: 'Delete request not found.' }, { status: 404 });
    }

    const donationResponse = await fetch(
      `${firebaseConfig.databaseURL}/donations/${encodeURIComponent(requestRecord.donationId)}.json?auth=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );
    const donationRecord = donationResponse.ok ? ((await donationResponse.json()) as DonationRecord | null) : null;
    const donorName = donationRecord?.name || requestRecord.donationName || 'Unknown donor';

    if (action === 'approve') {
      const deleteDonationResponse = await fetch(
        `${firebaseConfig.databaseURL}/donations/${encodeURIComponent(requestRecord.donationId)}.json?auth=${encodeURIComponent(idToken)}`,
        {
          method: 'DELETE',
          cache: 'no-store',
        }
      );

      if (!deleteDonationResponse.ok) {
        return Response.json({ error: 'Failed to delete the donation record.' }, { status: deleteDonationResponse.status });
      }

      await createActivityLog({
        session,
        idToken,
        log: {
          action: 'approved_delete_request',
          module: 'donation',
          subject: {
            type: donationRecord?.donorType === 'Unregistered User' ? 'donor' : 'user',
            id: donationRecord?.userId,
            name: donorName,
          },
          target: {
            type: 'donation',
            id: requestRecord.donationId,
            name: `Donation by ${donorName}`,
          },
          description: `${session.name || session.email} approved ${requestRecord.requestedByName || 'System Admin'}'s delete request and deleted ${donorName}'s donation record.`,
          metadata: {
            requestId,
            requestedByName: requestRecord.requestedByName,
            amount: donationRecord?.amount,
            platform: donationRecord?.platform,
          },
        },
      });

      await createAdminNotification({
        uid: requestRecord.requestedByUid,
        idToken,
        notification: {
          type: 'delete_request_resolved',
          title: 'Your donation delete request was approved',
          description: `${session.name || session.email} approved your delete request for ${donorName}'s donation record.`,
          href: '/donation',
        },
      });

      await createAdminNotification({
        uid: session.uid,
        idToken,
        notification: {
          type: 'delete_request_resolved',
          title: `${requestRecord.requestedByName || 'System Admin'} requested donation deletion`,
          description: `${requestRecord.donationName || donorName || 'Unknown donation'} - Request approved`,
          href: '/donation',
          read: true,
        },
      });
    } else {
      const resetDonationStatusResponse = await fetch(
        `${firebaseConfig.databaseURL}/donations/${encodeURIComponent(requestRecord.donationId)}.json?auth=${encodeURIComponent(idToken)}`,
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

      if (!resetDonationStatusResponse.ok) {
        return Response.json({ error: 'Failed to update the donation request status.' }, { status: resetDonationStatusResponse.status });
      }

      await createActivityLog({
        session,
        idToken,
        log: {
          action: 'rejected_delete_request',
          module: 'donation',
          subject: {
            type: donationRecord?.donorType === 'Unregistered User' ? 'donor' : 'user',
            id: donationRecord?.userId,
            name: donorName,
          },
          target: {
            type: 'donation',
            id: requestRecord.donationId,
            name: `Donation by ${donorName}`,
          },
          description: `${session.name || session.email} rejected ${requestRecord.requestedByName || 'System Admin'}'s delete request for ${donorName}'s donation record.`,
          metadata: {
            requestId,
            requestedByName: requestRecord.requestedByName,
            amount: donationRecord?.amount,
            platform: donationRecord?.platform,
          },
        },
      });

      await createAdminNotification({
        uid: requestRecord.requestedByUid,
        idToken,
        notification: {
          type: 'delete_request_resolved',
          title: 'Your donation delete request was rejected',
          description: `${session.name || session.email} rejected your delete request for ${donorName}'s donation record.`,
          href: `/donation/${encodeURIComponent(requestRecord.donationId)}`,
        },
      });

      await createAdminNotification({
        uid: session.uid,
        idToken,
        notification: {
          type: 'delete_request_resolved',
          title: `${requestRecord.requestedByName || 'System Admin'} requested donation deletion`,
          description: `${requestRecord.donationName || donorName || 'Unknown donation'} - Request rejected`,
          href: `/donation/${encodeURIComponent(requestRecord.donationId)}`,
          read: true,
        },
      });
    }

    const deleteRequestResponse = await fetch(
      `${firebaseConfig.databaseURL}/donationDeleteRequests/${encodeURIComponent(requestId)}.json?auth=${encodeURIComponent(idToken)}`,
      {
        method: 'DELETE',
        cache: 'no-store',
      }
    );

    if (!deleteRequestResponse.ok) {
      return Response.json({ error: 'Failed to remove the delete request.' }, { status: deleteRequestResponse.status });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update the delete request.' }, { status: 500 });
  }
}
