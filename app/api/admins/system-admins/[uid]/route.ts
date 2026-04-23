import { requireSession } from '@/lib/auth/session';
import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';
import { createActivityLog } from '@/lib/audit/activity-log';
import { archiveDeletedRecord } from '@/lib/archive/trash';

type RouteContext = {
  params: Promise<{
    uid: string;
  }>;
};

const getIdTokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
};

type AdminRecord = {
  email?: string;
  name?: string;
  role?: string;
  status?: string;
  mustChangePassword?: boolean;
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();

    if (session.role !== 'super_admin') {
      return Response.json({ error: 'Only super admins can delete system admin accounts.' }, { status: 403 });
    }

    const idToken = getIdTokenFromRequest(request);

    if (!idToken) {
      return Response.json({ error: 'Missing Firebase token.' }, { status: 401 });
    }

    const authUser = await verifyFirebaseIdToken(idToken);

    if (!authUser || authUser.uid !== session.uid) {
      return Response.json({ error: 'Invalid Firebase session.' }, { status: 401 });
    }

    const { uid } = await context.params;

    if (uid === session.uid) {
      return Response.json({ error: 'You cannot remove your own super admin access here.' }, { status: 400 });
    }

    const adminResponse = await fetch(
      `${firebaseConfig.databaseURL}/admins/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );

    if (!adminResponse.ok) {
      return Response.json({ error: 'Failed to load the system admin before deletion.' }, { status: adminResponse.status });
    }

    const adminRecord = (await adminResponse.json()) as AdminRecord | null;
    if (!adminRecord) {
      return Response.json({ error: 'System admin record not found.' }, { status: 404 });
    }

    await archiveDeletedRecord({
      idToken,
      path: `admins/${uid}`,
      record: adminRecord as Record<string, unknown>,
    });

    const response = await fetch(
      `${firebaseConfig.databaseURL}/admins/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(idToken)}`,
      {
        method: 'DELETE',
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to remove the system admin record.' }, { status: response.status });
    }

    await createActivityLog({
      session,
      idToken,
      log: {
        action: 'deleted_system_admin',
        module: 'users',
        subject: {
          type: 'admin',
          id: uid,
          name: adminRecord.name || adminRecord.email || 'Unknown admin',
        },
        target: {
          type: 'system_admin',
          id: uid,
          name: adminRecord.name || adminRecord.email || 'Unknown admin',
        },
        description: `${session.name || session.email} removed system admin account ${adminRecord.name || adminRecord.email || 'Unknown admin'}.`,
        metadata: {
          email: adminRecord.email,
          previousStatus: adminRecord.status,
          role: adminRecord.role,
        },
      },
    });

    return Response.json({
      ok: true,
      note: 'The admin profile was removed. Firebase Auth cleanup can be added later if needed.',
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to remove the system admin record.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireSession();

    if (session.role !== 'super_admin') {
      return Response.json({ error: 'Only super admins can update system admin accounts.' }, { status: 403 });
    }

    const idToken = getIdTokenFromRequest(request);

    if (!idToken) {
      return Response.json({ error: 'Missing Firebase token.' }, { status: 401 });
    }

    const authUser = await verifyFirebaseIdToken(idToken);

    if (!authUser || authUser.uid !== session.uid) {
      return Response.json({ error: 'Invalid Firebase session.' }, { status: 401 });
    }

    const { status } = (await request.json()) as { status?: string };
    const normalizedStatus = status?.trim().toLowerCase();

    if (normalizedStatus !== 'active' && normalizedStatus !== 'inactive') {
      return Response.json({ error: 'Status must be either active or inactive.' }, { status: 400 });
    }

    const { uid } = await context.params;

    const adminResponse = await fetch(
      `${firebaseConfig.databaseURL}/admins/${encodeURIComponent(uid)}.json?auth=${encodeURIComponent(idToken)}`,
      { cache: 'no-store' }
    );

    if (!adminResponse.ok) {
      return Response.json({ error: 'Failed to load the system admin before status update.' }, { status: adminResponse.status });
    }

    const adminRecord = (await adminResponse.json()) as AdminRecord | null;
    if (!adminRecord) {
      return Response.json({ error: 'System admin record not found.' }, { status: 404 });
    }

    const response = await fetch(
      `${firebaseConfig.databaseURL}/admins/${encodeURIComponent(uid)}/status.json?auth=${encodeURIComponent(idToken)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(normalizedStatus),
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to update the system admin status.' }, { status: response.status });
    }

    if (adminRecord.status !== normalizedStatus) {
      await createActivityLog({
        session,
        idToken,
        log: {
          action: 'updated_system_admin_status',
          module: 'users',
          subject: {
            type: 'admin',
            id: uid,
            name: adminRecord.name || adminRecord.email || 'Unknown admin',
          },
          target: {
            type: 'system_admin',
            id: uid,
            name: adminRecord.name || adminRecord.email || 'Unknown admin',
          },
          description: `${session.name || session.email} updated system admin ${adminRecord.name || adminRecord.email || 'Unknown admin'} from ${adminRecord.status || 'unknown'} to ${normalizedStatus}.`,
          metadata: {
            email: adminRecord.email,
            previousStatus: adminRecord.status,
            newStatus: normalizedStatus,
          },
        },
      });
    }

    return Response.json({
      ok: true,
      status: normalizedStatus,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update the system admin status.' }, { status: 500 });
  }
}
