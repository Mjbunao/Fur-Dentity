import { requireSession } from '@/lib/auth/session';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';
import { firebaseConfig } from '@/lib/firebase-config';

type BulkPayload = {
  action?: 'read' | 'delete';
  notificationIds?: string[];
};

const getIdTokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
};

const requireVerifiedAdmin = async (request: Request) => {
  const session = await requireSession();
  const idToken = getIdTokenFromRequest(request);

  if (!idToken) {
    return {
      error: Response.json({ error: 'Missing Firebase token.' }, { status: 401 }),
    };
  }

  const authUser = await verifyFirebaseIdToken(idToken);
  if (!authUser || authUser.uid !== session.uid) {
    return {
      error: Response.json({ error: 'Invalid Firebase session.' }, { status: 401 }),
    };
  }

  return { session, idToken };
};

export async function POST(request: Request) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const body = (await request.json()) as BulkPayload;
    if ((body.action !== 'read' && body.action !== 'delete') || !Array.isArray(body.notificationIds)) {
      return Response.json({ error: 'Action and notification IDs are required.' }, { status: 400 });
    }

    const notificationState = body.action === 'read' ? 'read' : 'deleted';
    const uniqueIds = [...new Set(body.notificationIds.map((id) => id.trim()).filter(Boolean))];

    if (uniqueIds.length === 0) {
      return Response.json({ ok: true });
    }

    const payload = Object.fromEntries(uniqueIds.map((id) => [id, true]));
    const response = await fetch(
      `${firebaseConfig.databaseURL}/web-admin/${encodeURIComponent(verified.session.uid)}/notificationState/${notificationState}.json?auth=${encodeURIComponent(verified.idToken)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to update notifications.' }, { status: response.status });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update notifications.' }, { status: 500 });
  }
}
