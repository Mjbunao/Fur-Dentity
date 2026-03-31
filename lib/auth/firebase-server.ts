import 'server-only';

import { firebaseConfig } from '@/lib/firebase-config';
import type { AdminProfile } from './types';

type LookupResponse = {
  users?: Array<{
    localId?: string;
    email?: string;
  }>;
};

export async function verifyFirebaseIdToken(idToken: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as LookupResponse;
  const user = data.users?.[0];

  if (!user?.localId || !user.email) {
    return null;
  }

  return {
    uid: user.localId,
    email: user.email,
  };
}

export async function getAdminProfileByUid(uid: string) {
  const response = await fetch(`${firebaseConfig.databaseURL}/admins/${uid}.json`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Partial<AdminProfile> | null;

  if (!data || (data.role !== 'super_admin' && data.role !== 'system_admin')) {
    return null;
  }

  return {
    email: typeof data.email === 'string' ? data.email : '',
    name: typeof data.name === 'string' ? data.name : undefined,
    role: data.role,
    status: typeof data.status === 'string' ? data.status : undefined,
    mustChangePassword: data.mustChangePassword === true,
  } satisfies AdminProfile;
}

export async function getAdminProfileByUidWithToken(uid: string, idToken: string) {
  const response = await fetch(
    `${firebaseConfig.databaseURL}/admins/${uid}.json?auth=${encodeURIComponent(idToken)}`,
    {
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Partial<AdminProfile> | null;

  if (!data || (data.role !== 'super_admin' && data.role !== 'system_admin')) {
    return null;
  }

  return {
    email: typeof data.email === 'string' ? data.email : '',
    name: typeof data.name === 'string' ? data.name : undefined,
    role: data.role,
    status: typeof data.status === 'string' ? data.status : undefined,
    mustChangePassword: data.mustChangePassword === true,
  } satisfies AdminProfile;
}

export async function getRawAdminRecordByUidWithToken(uid: string, idToken: string) {
  const response = await fetch(
    `${firebaseConfig.databaseURL}/admins/${uid}.json?auth=${encodeURIComponent(idToken)}`,
    {
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      data: null,
    };
  }

  const data = (await response.json()) as Record<string, unknown> | null;

  return {
    ok: true as const,
    status: response.status,
    data,
  };
}
