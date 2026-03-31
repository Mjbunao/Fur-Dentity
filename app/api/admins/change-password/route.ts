import { createSession, requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';

export async function POST(request: Request) {
  const session = await requireSession();

  try {
    const { idToken } = (await request.json()) as { idToken?: string };

    if (!idToken) {
      return Response.json({ error: 'Missing current identity token.' }, { status: 400 });
    }

    const authUser = await verifyFirebaseIdToken(idToken);

    if (!authUser || authUser.uid !== session.uid) {
      return Response.json({ error: 'Unable to verify the current admin session.' }, { status: 401 });
    }

    const response = await fetch(
      `${firebaseConfig.databaseURL}/admins/${session.uid}/mustChangePassword.json?auth=${encodeURIComponent(idToken)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(false),
      }
    );

    if (!response.ok) {
      return Response.json(
        { error: 'Password was updated, but the admin profile flag could not be cleared.' },
        { status: 500 }
      );
    }

    await createSession({
      uid: session.uid,
      email: session.email,
      name: session.name,
      role: session.role,
      mustChangePassword: false,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to complete password change.' }, { status: 500 });
  }
}
