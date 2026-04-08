import { requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';

type DeleteRequestRecord = {
  donationId?: string;
  donationName?: string;
  requestedByUid?: string;
  requestedByName?: string;
  requestedByEmail?: string;
  status?: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
  resolvedAt?: string;
};

type DonationRecord = {
  requestStatus?: 'pending' | 'approved' | 'rejected' | null;
};

const getIdTokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }
  return authorization.slice('Bearer '.length).trim();
};

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (session.role !== 'super_admin') {
      return Response.json({ error: 'Only super admins can view delete requests.' }, { status: 403 });
    }

    const idToken = getIdTokenFromRequest(request);
    if (!idToken) {
      return Response.json({ error: 'Missing Firebase token.' }, { status: 401 });
    }

    const authUser = await verifyFirebaseIdToken(idToken);
    if (!authUser || authUser.uid !== session.uid) {
      return Response.json({ error: 'Invalid Firebase session.' }, { status: 401 });
    }

    const response = await fetch(
      `${firebaseConfig.databaseURL}/donationDeleteRequests.json?auth=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to load delete requests.' }, { status: response.status });
    }

    const data = (await response.json()) as Record<string, DeleteRequestRecord> | null;
    const requests = Object.entries(data ?? {})
      .filter(([, request]) => request.status === 'pending')
      .map(([id, request]) => ({
        id,
        donationId: request.donationId || '',
        donationName: request.donationName || 'Unknown donation',
        requestedByUid: request.requestedByUid || '',
        requestedByName: request.requestedByName || 'Unknown admin',
        requestedByEmail: request.requestedByEmail || 'No email',
        status: request.status || 'pending',
        createdAt: request.createdAt || '',
        resolvedAt: request.resolvedAt,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return Response.json({ requests });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load delete requests.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (session.role !== 'system_admin') {
      return Response.json({ error: 'Only system admins can request donation deletion.' }, { status: 403 });
    }

    const idToken = getIdTokenFromRequest(request);
    if (!idToken) {
      return Response.json({ error: 'Missing Firebase token.' }, { status: 401 });
    }

    const authUser = await verifyFirebaseIdToken(idToken);
    if (!authUser || authUser.uid !== session.uid) {
      return Response.json({ error: 'Invalid Firebase session.' }, { status: 401 });
    }

    const body = (await request.json()) as DeleteRequestRecord;
    if (!body.donationId || !body.donationName) {
      return Response.json({ error: 'Donation information is required for a delete request.' }, { status: 400 });
    }

    const existingResponse = await fetch(
      `${firebaseConfig.databaseURL}/donationDeleteRequests.json?auth=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );
    const existingData = existingResponse.ok
      ? ((await existingResponse.json()) as Record<string, DeleteRequestRecord> | null)
      : null;

    const hasPending = Object.values(existingData ?? {}).some(
      (requestRecord) =>
        requestRecord.donationId === body.donationId && requestRecord.status === 'pending'
    );

    if (hasPending) {
      return Response.json({ error: 'A pending delete request already exists for this donation.' }, { status: 409 });
    }

    const payload: DeleteRequestRecord = {
      donationId: body.donationId,
      donationName: body.donationName,
      requestedByUid: body.requestedByUid || session.uid,
      requestedByName: body.requestedByName || session.name || 'System Admin',
      requestedByEmail: body.requestedByEmail || session.email,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const donationStatusResponse = await fetch(
      `${firebaseConfig.databaseURL}/donations/${encodeURIComponent(body.donationId)}.json?auth=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );

    if (!donationStatusResponse.ok) {
      return Response.json({ error: 'Failed to validate donation record.' }, { status: donationStatusResponse.status });
    }

    const donationRecord = (await donationStatusResponse.json()) as DonationRecord | null;
    if (donationRecord?.requestStatus === 'pending') {
      return Response.json({ error: 'A pending delete request already exists for this donation.' }, { status: 409 });
    }

    const response = await fetch(
      `${firebaseConfig.databaseURL}/donationDeleteRequests.json?auth=${encodeURIComponent(idToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to create delete request.' }, { status: response.status });
    }

    const updateDonationResponse = await fetch(
      `${firebaseConfig.databaseURL}/donations/${encodeURIComponent(body.donationId)}/requestStatus.json?auth=${encodeURIComponent(idToken)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify('pending'),
        cache: 'no-store',
      }
    );

    if (!updateDonationResponse.ok) {
      return Response.json({ error: 'Delete request was created but donation status could not be updated.' }, { status: updateDonationResponse.status });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create delete request.' }, { status: 500 });
  }
}
