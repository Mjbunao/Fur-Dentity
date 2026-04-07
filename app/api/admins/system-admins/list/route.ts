import { requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';

type SystemAdminRecord = {
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  mustChangePassword?: boolean;
  createdBy?: string;
  createdAt?: string;
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
      return Response.json({ error: 'Only super admins can view system admin accounts.' }, { status: 403 });
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
      `${firebaseConfig.databaseURL}/admins.json?auth=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to load system admin accounts.' }, { status: response.status });
    }

    const adminsData = (await response.json()) as Record<string, SystemAdminRecord> | null;

    const admins = Object.entries(adminsData ?? {})
      .filter(([, admin]) => admin.role === 'system_admin')
      .map(([uid, admin]) => ({
        uid,
        name: admin.name || 'Unnamed system admin',
        email: admin.email || 'No email',
        status: admin.status || 'unknown',
        mustChangePassword: admin.mustChangePassword === true,
        createdAt: admin.createdAt || '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return Response.json({ admins });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load system admin accounts.' }, { status: 500 });
  }
}
