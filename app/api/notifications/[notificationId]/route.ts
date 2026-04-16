import { requireSession } from '@/lib/auth/session';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';
import { firebaseConfig } from '@/lib/firebase-config';

type RouteContext = {
  params: Promise<{
    notificationId: string;
  }>;
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

const updateNotificationState = async ({
  uid,
  idToken,
  notificationId,
  state,
}: {
  uid: string;
  idToken: string;
  notificationId: string;
  state: 'read' | 'deleted';
}) => {
  const response = await fetch(
    `${firebaseConfig.databaseURL}/web-admin/${encodeURIComponent(uid)}/notificationState/${state}.json?auth=${encodeURIComponent(idToken)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [notificationId]: true }),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return Response.json({ error: `Failed to update notification ${state} state.` }, { status: response.status });
  }

  return Response.json({ ok: true });
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const { notificationId } = await context.params;

    return updateNotificationState({
      uid: verified.session.uid,
      idToken: verified.idToken,
      notificationId: decodeURIComponent(notificationId),
      state: 'read',
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to mark notification as read.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const { notificationId } = await context.params;

    return updateNotificationState({
      uid: verified.session.uid,
      idToken: verified.idToken,
      notificationId: decodeURIComponent(notificationId),
      state: 'deleted',
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete notification.' }, { status: 500 });
  }
}
