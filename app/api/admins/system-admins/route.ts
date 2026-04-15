import { requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { createActivityLog } from '@/lib/audit/activity-log';

type CreateAccountResponse = {
  localId?: string;
  email?: string;
  error?: {
    message?: string;
  };
};

const mapFirebaseAuthError = (message?: string) => {
  switch (message) {
    case 'EMAIL_EXISTS':
      return 'That email is already in use.';
    case 'WEAK_PASSWORD : Password should be at least 6 characters':
    case 'WEAK_PASSWORD':
      return 'Temporary password must be at least 6 characters.';
    default:
      return 'Could not create the system admin account.';
  }
};

export async function POST(request: Request) {
  const session = await requireSession();

  if (session.role !== 'super_admin') {
    return Response.json({ error: 'Only super admins can create system admin accounts.' }, { status: 403 });
  }

  try {
    const { idToken, name, email, temporaryPassword } = (await request.json()) as {
      idToken?: string;
      name?: string;
      email?: string;
      temporaryPassword?: string;
    };

    const trimmedName = name?.trim() ?? '';
    const trimmedEmail = email?.trim().toLowerCase() ?? '';
    const trimmedPassword = temporaryPassword?.trim() ?? '';

    if (!idToken) {
      return Response.json({ error: 'Missing current admin identity token.' }, { status: 400 });
    }

    if (!trimmedName || !trimmedEmail || !trimmedPassword) {
      return Response.json({ error: 'Name, email, and temporary password are required.' }, { status: 400 });
    }

    if (trimmedPassword.length < 6) {
      return Response.json({ error: 'Temporary password must be at least 6 characters.' }, { status: 400 });
    }

    const createUserResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password: trimmedPassword,
          returnSecureToken: false,
        }),
      }
    );

    const createUserData = (await createUserResponse.json()) as CreateAccountResponse;

    if (!createUserResponse.ok || !createUserData.localId) {
      return Response.json(
        { error: mapFirebaseAuthError(createUserData.error?.message) },
        { status: 400 }
      );
    }

    const newUid = createUserData.localId;

    const adminWriteResponse = await fetch(
      `${firebaseConfig.databaseURL}/admins/${newUid}.json?auth=${encodeURIComponent(idToken)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          name: trimmedName,
          role: 'system_admin',
          status: 'active',
          mustChangePassword: true,
          createdBy: session.uid,
          createdAt: new Date().toISOString(),
        }),
      }
    );

    if (!adminWriteResponse.ok) {
      return Response.json(
        {
          error:
            'The Firebase Auth user was created, but the admin profile write was blocked. Check your Realtime Database rules for super-admin writes to admins.',
        },
        { status: 500 }
      );
    }

    await createActivityLog({
      session,
      idToken,
      log: {
        action: 'created_system_admin',
        module: 'users',
        subject: {
          type: 'admin',
          id: newUid,
          name: trimmedName,
        },
        target: {
          type: 'system_admin',
          id: newUid,
          name: trimmedName,
        },
        description: `${session.name || session.email} created system admin account ${trimmedName}.`,
        metadata: {
          email: trimmedEmail,
          status: 'active',
          mustChangePassword: true,
        },
      },
    });

    return Response.json({
      ok: true,
      admin: {
        uid: newUid,
        email: trimmedEmail,
        name: trimmedName,
        role: 'system_admin',
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create system admin account.' }, { status: 500 });
  }
}
