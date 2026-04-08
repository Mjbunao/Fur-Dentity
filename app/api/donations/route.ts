import { requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';

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

const normalizeDonation = (id: string, donation: DonationRecord, requestStatus?: string | null) => ({
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
    requestStatus === 'pending' || requestStatus === 'approved' || requestStatus === 'rejected'
      ? requestStatus
      : null,
});

export async function GET(request: Request) {
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

    const donationsResponse = await fetch(
      `${firebaseConfig.databaseURL}/donations.json?auth=${encodeURIComponent(idToken)}`,
      {
        cache: 'no-store',
      }
    );

    if (!donationsResponse.ok) {
      return Response.json({ error: 'Failed to load donations.' }, { status: donationsResponse.status });
    }

    const donationsData = (await donationsResponse.json()) as Record<string, DonationRecord> | null;

    const donations = Object.entries(donationsData ?? {})
      .map(([id, donation]) => normalizeDonation(id, donation, donation.requestStatus ?? null))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return Response.json({ donations });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load donations.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const donationPayload: DonationRecord = {
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
      createdAt: new Date().toISOString(),
    };

    if (
      !donationPayload.name ||
      !donationPayload.email ||
      !donationPayload.contact ||
      !donationPayload.address ||
      !donationPayload.date ||
      !donationPayload.platform ||
      !donationPayload.reference ||
      !donationPayload.amount
    ) {
      return Response.json({ error: 'Please complete all required donation fields.' }, { status: 400 });
    }

    const response = await fetch(
      `${firebaseConfig.databaseURL}/donations.json?auth=${encodeURIComponent(idToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(donationPayload),
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to save donation.' }, { status: response.status });
    }

    const data = (await response.json()) as { name?: string };
    if (!data.name) {
      return Response.json({ error: 'Donation key was not created.' }, { status: 500 });
    }

    return Response.json({ donation: normalizeDonation(data.name, donationPayload, null) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to save donation.' }, { status: 500 });
  }
}
