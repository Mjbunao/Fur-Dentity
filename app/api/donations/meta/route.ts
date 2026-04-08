import { requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';

type UserRecord = {
  firstName?: string;
  lastName?: string;
  email?: string;
  contactNumber?: string;
  address?: {
    fullAddress?: string;
  };
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
    const idToken = getIdTokenFromRequest(request);

    if (!idToken) {
      return Response.json({ error: 'Missing Firebase token.' }, { status: 401 });
    }

    const authUser = await verifyFirebaseIdToken(idToken);
    if (!authUser || authUser.uid !== session.uid) {
      return Response.json({ error: 'Invalid Firebase session.' }, { status: 401 });
    }

    const response = await fetch(`${firebaseConfig.databaseURL}/users.json?auth=${encodeURIComponent(idToken)}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return Response.json({ error: 'Failed to load donation form data.' }, { status: response.status });
    }

    const usersData = (await response.json()) as Record<string, UserRecord> | null;
    const users = Object.entries(usersData ?? {})
      .map(([id, user]) => ({
        id,
        name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'No name',
        email: user.email || 'No email',
        contact: user.contactNumber || 'No contact',
        address: user.address?.fullAddress || 'No address',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return Response.json({ users });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load donation form data.' }, { status: 500 });
  }
}
