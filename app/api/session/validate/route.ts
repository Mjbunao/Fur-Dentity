import {
  getAdminProfileByUidWithToken,
  verifyFirebaseIdToken,
} from '@/lib/auth/firebase-server';
import { deleteSession, requireSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const { idToken } = (await request.json()) as { idToken?: string };

    if (!idToken) {
      await deleteSession();
      return Response.json({ error: 'Missing id token.' }, { status: 400 });
    }

    const authUser = await verifyFirebaseIdToken(idToken);

    if (!authUser || authUser.uid !== session.uid) {
      await deleteSession();
      return Response.json({ error: 'Invalid Firebase session.' }, { status: 401 });
    }

    const adminProfile = await getAdminProfileByUidWithToken(authUser.uid, idToken);

    if (!adminProfile) {
      await deleteSession();
      return Response.json({ error: 'This account is no longer authorized for the admin web.' }, { status: 403 });
    }

    if (adminProfile.status && adminProfile.status !== 'active') {
      await deleteSession();
      return Response.json({ error: 'This admin account is inactive.' }, { status: 403 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    await deleteSession();
    return Response.json({ error: 'Failed to validate session.' }, { status: 500 });
  }
}
