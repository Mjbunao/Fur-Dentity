import 'server-only';

import { firebaseConfig } from '@/lib/firebase-config';

type AdminNotificationPayload = {
  uid?: string;
  idToken: string;
  notification: {
    type: 'delete_request_resolved';
    title: string;
    description: string;
    href: string;
    createdAt?: string;
    read?: boolean;
  };
};

export async function createAdminNotification({
  uid,
  idToken,
  notification,
}: AdminNotificationPayload) {
  if (!uid) {
    return;
  }

  const response = await fetch(
    `${firebaseConfig.databaseURL}/web-admin/${encodeURIComponent(uid)}/notifications.json?auth=${encodeURIComponent(idToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...notification,
        createdAt: notification.createdAt || new Date().toISOString(),
      }),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new Error('Failed to create admin notification.');
  }

  if (notification.read) {
    const data = (await response.json()) as { name?: string } | null;
    if (!data?.name) {
      return;
    }

    const readResponse = await fetch(
      `${firebaseConfig.databaseURL}/web-admin/${encodeURIComponent(uid)}/notificationState/read.json?auth=${encodeURIComponent(idToken)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [`stored_${data.name}`]: true }),
        cache: 'no-store',
      }
    );

    if (!readResponse.ok) {
      throw new Error('Failed to mark stored admin notification as read.');
    }
  }
}
