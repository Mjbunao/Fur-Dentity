import 'server-only';

import { firebaseConfig } from '@/lib/firebase-config';
import type { SessionPayload } from '@/lib/auth/types';

export type ActivityLogInput = {
  action: string;
  module: string;
  subject?: {
    type: string;
    id?: string;
    name?: string;
  };
  target: {
    type: string;
    id: string;
    name: string;
  };
  description: string;
  metadata?: Record<string, unknown>;
};

const removeUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(removeUndefined);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, removeUndefined(item)])
    );
  }

  return value;
};

export async function createActivityLog({
  session,
  idToken,
  log,
}: {
  session: SessionPayload;
  idToken: string;
  log: ActivityLogInput;
}) {
  const payload = removeUndefined({
    actor: {
      uid: session.uid,
      name: session.name || session.email,
      email: session.email,
      role: session.role,
      type: 'admin',
    },
    action: log.action,
    module: log.module,
    subject: log.subject,
    target: log.target,
    description: log.description,
    metadata: log.metadata,
    createdAt: new Date().toISOString(),
  });

  const response = await fetch(
    `${firebaseConfig.databaseURL}/activityLogs.json?auth=${encodeURIComponent(idToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    console.warn('Failed to create activity log.', response.status);
  }
}
