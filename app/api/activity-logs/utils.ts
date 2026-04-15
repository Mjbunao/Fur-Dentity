import { firebaseConfig } from '@/lib/firebase-config';
import { verifyFirebaseIdToken } from '@/lib/auth/firebase-server';
import { requireSession } from '@/lib/auth/session';

export type ActivityLogRecord = {
  actor?: {
    uid?: string;
    name?: string;
    email?: string;
    role?: string;
    type?: string;
  };
  action?: string;
  module?: string;
  subject?: {
    type?: string;
    id?: string;
    name?: string;
  };
  target?: {
    type?: string;
    id?: string;
    name?: string;
  };
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export const getIdTokenFromRequest = (request: Request) => {
  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
};

export const normalizeActivityLog = (id: string, log: ActivityLogRecord) => ({
  id,
  actor: {
    uid: log.actor?.uid || '',
    name: log.actor?.name || 'Unknown admin',
    email: log.actor?.email || 'No email',
    role: log.actor?.role || 'admin',
    type: log.actor?.type || 'admin',
  },
  action: log.action || 'unknown_action',
  module: log.module || 'unknown',
  subject: log.subject || null,
  target: {
    type: log.target?.type || 'record',
    id: log.target?.id || '',
    name: log.target?.name || 'Unknown record',
  },
  description: log.description || 'No activity description available.',
  metadata: log.metadata || {},
  createdAt: log.createdAt || '',
});

export const requireActivityLogAccess = async (request: Request) => {
  const session = await requireSession();
  if (session.role !== 'super_admin') {
    return {
      error: Response.json({ error: 'Only super admins can view activity logs.' }, { status: 403 }),
    };
  }

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

export const activityLogsUrl = firebaseConfig.databaseURL;
