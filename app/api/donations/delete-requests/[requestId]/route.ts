import { requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';

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
    } else {
      const resetDonationStatusResponse = await fetch(
        `${firebaseConfig.databaseURL}/donations/${encodeURIComponent(requestRecord.donationId)}/requestStatus.json?auth=${encodeURIComponent(idToken)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify('rejected'),
          cache: 'no-store',
        }
      );

      if (!resetDonationStatusResponse.ok) {
        return Response.json({ error: 'Failed to update the donation request status.' }, { status: resetDonationStatusResponse.status });
      }
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
