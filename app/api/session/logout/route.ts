import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';
import { createActivityLog } from '@/lib/audit/activity-log';
import { deleteSession, getSession } from '@/lib/auth/session';

const getIdTokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
};

export async function POST(request: Request) {
  const session = await getSession();
  const idToken = getIdTokenFromRequest(request);

  if (session && idToken) {
    const authUser = await verifyFirebaseIdToken(idToken).catch(() => null);

    if (authUser?.uid === session.uid) {
      await createActivityLog({
        session,
        idToken,
        log: {
          action: 'admin_logged_out',
          module: 'auth',
          subject: {
            type: 'admin',
            id: session.uid,
            name: session.name || session.email,
          },
          target: {
            type: 'admin_session',
            id: session.uid,
            name: session.name || session.email,
          },
          description: `${session.name || session.email} logged out from the admin web.`,
          metadata: {
            email: session.email,
            role: session.role,
          },
        },
      });
    }
  }

  await deleteSession();
  return Response.json({ ok: true });
}
