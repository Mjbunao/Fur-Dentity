import { requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';

type RouteContext = {
  params: Promise<{
    donationId: string;
  }>;
};

type DonationRecord = {
  donorType?: string;
  userId?: string;
  name?: string;
  email?: string;
  contact?: string;
  address?: string;
  amount?: number;
  date?: string;
  platform?: string;
  reference?: string;
  createdAt?: string;
  requestStatus?: 'pending' | 'approved' | 'rejected' | null;
};

const formatDate = (value?: string) => {
  if (!value) {
    return 'Unknown';
  }

  const normalized = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : value;
};

const getIdTokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }
  return authorization.slice('Bearer '.length).trim();
};

const normalizeDonation = (id: string, donation: DonationRecord) => ({
  id,
  donorType: donation.donorType === 'Unregistered User' ? 'Unregistered User' : 'Registered User',
  userId: donation.userId || '',
  name: donation.name || 'Unknown',
  email: donation.email || 'No email',
  contact: donation.contact || 'No contact',
  address: donation.address || 'No address',
  amount: Number(donation.amount) || 0,
  date: formatDate(donation.date),
  platform: donation.platform || 'Unknown',
  reference: donation.reference || 'Unknown',
  createdAt: donation.createdAt || '',
  requestStatus:
    donation.requestStatus === 'pending' ||
    donation.requestStatus === 'approved' ||
    donation.requestStatus === 'rejected'
      ? donation.requestStatus
      : null,
});

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const idToken = getIdTokenFromRequest(request);

    if (!idToken) {
      return Response.json({ error: 'Missing Firebase token.' }, { status: 401 });
    }

    const authUser = await verifyFirebaseIdToken(idToken);
    if (!authUser || authUser.uid !== session.uid) {
      return Response.json({ error: 'Invalid Firebase session.' }, { status: 401 });
    }

    const { donationId } = await context.params;
    const response = await fetch(
      `${firebaseConfig.databaseURL}/donations/${encodeURIComponent(donationId)}.json?auth=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to load donation details.' }, { status: response.status });
    }

    const donation = (await response.json()) as DonationRecord | null;
    if (!donation) {
      return Response.json({ error: 'Donation not found.' }, { status: 404 });
    }

    return Response.json({ donation: normalizeDonation(donationId, donation) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load donation details.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const idToken = getIdTokenFromRequest(request);

    if (!idToken) {
      return Response.json({ error: 'Missing Firebase token.' }, { status: 401 });
    }

    const authUser = await verifyFirebaseIdToken(idToken);
    if (!authUser || authUser.uid !== session.uid) {
      return Response.json({ error: 'Invalid Firebase session.' }, { status: 401 });
    }

    const body = (await request.json()) as DonationRecord;
    const { donationId } = await context.params;

    const payload: DonationRecord = {
      donorType: body.donorType === 'Unregistered User' ? 'Unregistered User' : 'Registered User',
      userId: body.userId || '',
      name: body.name?.trim(),
      email: body.email?.trim(),
      contact: body.contact?.trim(),
      address: body.address?.trim(),
      amount: Number(body.amount) || 0,
      date: body.date?.trim(),
      platform: body.platform?.trim(),
      reference: body.reference?.trim(),
      createdAt: body.createdAt || new Date().toISOString(),
      requestStatus:
        body.requestStatus === 'pending' ||
        body.requestStatus === 'approved' ||
        body.requestStatus === 'rejected'
          ? body.requestStatus
          : null,
    };

    const response = await fetch(
      `${firebaseConfig.databaseURL}/donations/${encodeURIComponent(donationId)}.json?auth=${encodeURIComponent(idToken)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to update donation.' }, { status: response.status });
    }

    return Response.json({ donation: normalizeDonation(donationId, payload) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update donation.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    if (session.role !== 'super_admin') {
      return Response.json({ error: 'Only the super admin can delete donations.' }, { status: 403 });
    }

    const idToken = getIdTokenFromRequest(request);
    if (!idToken) {
      return Response.json({ error: 'Missing Firebase token.' }, { status: 401 });
    }

    const authUser = await verifyFirebaseIdToken(idToken);
    if (!authUser || authUser.uid !== session.uid) {
      return Response.json({ error: 'Invalid Firebase session.' }, { status: 401 });
    }

    const { donationId } = await context.params;
    const response = await fetch(
      `${firebaseConfig.databaseURL}/donations/${encodeURIComponent(donationId)}.json?auth=${encodeURIComponent(idToken)}`,
      {
        method: 'DELETE',
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to delete donation.' }, { status: response.status });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete donation.' }, { status: 500 });
  }
}
