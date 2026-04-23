import { requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';
import { createActivityLog } from '@/lib/audit/activity-log';
import { archiveDeletedRecord } from '@/lib/archive/trash';

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
  deleteRequestId?: string | null;
  deleteRequestByUid?: string | null;
};

const formatDate = (value?: string) => {
  if (!value) {
    return 'Unknown';
  }

  const normalized = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : value;
};

const formatAmount = (value?: number) => `PHP ${(Number(value) || 0).toLocaleString('en-US')}`;

const fieldChanged = (left?: string | number, right?: string | number) =>
  String(left ?? '').trim() !== String(right ?? '').trim();

const buildChangedFields = (previous: DonationRecord | null, next: DonationRecord) =>
  [
    {
      field: 'Date',
      from: formatDate(previous?.date),
      to: formatDate(next.date),
      changed: fieldChanged(formatDate(previous?.date), formatDate(next.date)),
    },
    {
      field: 'Amount',
      from: formatAmount(previous?.amount),
      to: formatAmount(next.amount),
      changed: fieldChanged(Number(previous?.amount) || 0, Number(next.amount) || 0),
    },
    {
      field: 'Platform',
      from: previous?.platform || 'Unknown',
      to: next.platform || 'Unknown',
      changed: fieldChanged(previous?.platform || 'Unknown', next.platform || 'Unknown'),
    },
    {
      field: 'Reference',
      from: previous?.reference || 'Unknown',
      to: next.reference || 'Unknown',
      changed: fieldChanged(previous?.reference || 'Unknown', next.reference || 'Unknown'),
    },
  ].filter((entry) => entry.changed);

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
    const currentResponse = await fetch(
      `${firebaseConfig.databaseURL}/donations/${encodeURIComponent(donationId)}.json?auth=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );
    if (!currentResponse.ok) {
      return Response.json({ error: 'Failed to load donation before update.' }, { status: currentResponse.status });
    }

    const currentDonation = (await currentResponse.json()) as DonationRecord | null;
    if (!currentDonation) {
      return Response.json({ error: 'Donation not found.' }, { status: 404 });
    }

    const payload: DonationRecord = {
      donorType: currentDonation.donorType === 'Unregistered User' ? 'Unregistered User' : 'Registered User',
      userId: currentDonation.userId || '',
      name: currentDonation.name?.trim(),
      email: currentDonation.email?.trim(),
      contact: currentDonation.contact?.trim(),
      address: currentDonation.address?.trim(),
      amount: Number(body.amount) || 0,
      date: body.date?.trim(),
      platform: body.platform?.trim(),
      reference: body.reference?.trim(),
      createdAt: currentDonation.createdAt || body.createdAt || new Date().toISOString(),
      requestStatus:
        currentDonation.requestStatus === 'pending' ||
        currentDonation.requestStatus === 'approved' ||
        currentDonation.requestStatus === 'rejected'
          ? currentDonation.requestStatus
          : null,
      deleteRequestId: currentDonation.deleteRequestId || null,
      deleteRequestByUid: currentDonation.deleteRequestByUid || null,
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

    const changedFields = buildChangedFields(currentDonation, payload);

    if (changedFields.length > 0) {
      const changesDescription = changedFields
        .map((entry) => `${entry.field} from ${entry.from} to ${entry.to}`)
        .join('; ');

      await createActivityLog({
        session,
        idToken,
        log: {
          action: 'updated_donation',
          module: 'donation',
          subject: {
            type: payload.donorType === 'Registered User' ? 'user' : 'donor',
            id: payload.userId,
            name: payload.name,
          },
          target: {
            type: 'donation',
            id: donationId,
            name: `Donation by ${payload.name}`,
          },
          description: `${session.name || session.email} updated ${payload.name}'s donation record: ${changesDescription}.`,
          metadata: {
            changedFields: changedFields.map(({ field, from, to }) => ({ field, from, to })),
            donorType: payload.donorType,
          },
        },
      });
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
    const donationResponse = await fetch(
      `${firebaseConfig.databaseURL}/donations/${encodeURIComponent(donationId)}.json?auth=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );
    const donationRecord = donationResponse.ok ? ((await donationResponse.json()) as DonationRecord | null) : null;

    if (!donationRecord) {
      return Response.json({ error: 'Donation not found.' }, { status: 404 });
    }

    await archiveDeletedRecord({
      idToken,
      path: `donation/${donationId}`,
      record: donationRecord as Record<string, unknown>,
    });

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

    if (donationRecord.requestStatus === 'pending' && donationRecord.deleteRequestId) {
      const requestCleanupResponse = await fetch(
        `${firebaseConfig.databaseURL}/donationDeleteRequests/${encodeURIComponent(donationRecord.deleteRequestId)}.json?auth=${encodeURIComponent(idToken)}`,
        {
          method: 'DELETE',
          cache: 'no-store',
        }
      );

      if (!requestCleanupResponse.ok) {
        console.warn('Failed to clean up donation delete request.', requestCleanupResponse.status);
      }
    }

    await createActivityLog({
      session,
      idToken,
      log: {
        action: 'deleted_donation',
        module: 'donation',
        subject: {
          type: donationRecord.donorType === 'Unregistered User' ? 'donor' : 'user',
          id: donationRecord.userId,
          name: donationRecord.name || 'Unknown donor',
        },
        target: {
          type: 'donation',
          id: donationId,
          name: `Donation by ${donationRecord.name || 'Unknown donor'}`,
        },
        description: `${session.name || session.email} directly deleted ${donationRecord.name || 'Unknown donor'}'s donation record.`,
        metadata: {
          amount: donationRecord.amount,
          platform: donationRecord.platform,
          donorType: donationRecord.donorType,
        },
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete donation.' }, { status: 500 });
  }
}
