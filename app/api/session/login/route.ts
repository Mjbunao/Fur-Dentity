import {
  getAdminProfileByUidWithToken,
  verifyFirebaseIdToken,
} from '@/lib/auth/firebase-server';
import { createSession } from '@/lib/auth/session';
import { createActivityLog } from '@/lib/audit/activity-log';

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };

    if (!idToken) {
      return Response.json({ error: 'Missing id token.' }, { status: 400 });
    }

    const authUser = await verifyFirebaseIdToken(idToken);

    if (!authUser) {
      return Response.json({ error: 'Invalid Firebase session.' }, { status: 401 });
    }

    const adminProfile = await getAdminProfileByUidWithToken(authUser.uid, idToken);

    if (!adminProfile) {
      return Response.json({ error: 'This account is not authorized for the admin web.' }, { status: 403 });
    }

    if (adminProfile.status && adminProfile.status !== 'active') {
      return Response.json({ error: 'This admin account is inactive.' }, { status: 403 });
    }

    const sessionPayload = {
      uid: authUser.uid,
      email: adminProfile.email || authUser.email,
      role: adminProfile.role,
      mustChangePassword: adminProfile.mustChangePassword === true,
      ...(adminProfile.name ? { name: adminProfile.name } : {}),
    };

    await createSession(sessionPayload);

    await createActivityLog({
      session: sessionPayload,
      idToken,
      log: {
        action: 'admin_logged_in',
        module: 'auth',
        subject: {
          type: 'admin',
          id: authUser.uid,
          name: adminProfile.name || adminProfile.email || authUser.email,
        },
        target: {
          type: 'admin_session',
          id: authUser.uid,
          name: adminProfile.name || adminProfile.email || authUser.email || 'Admin session',
        },
        description: `${adminProfile.name || adminProfile.email || authUser.email} logged in to the admin web.`,
        metadata: {
          email: adminProfile.email || authUser.email,
          role: adminProfile.role,
          mustChangePassword: adminProfile.mustChangePassword === true,
        },
      },
    });

    return Response.json({
      ok: true,
      mustChangePassword: adminProfile.mustChangePassword === true,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create session.' }, { status: 500 });
  }
}
