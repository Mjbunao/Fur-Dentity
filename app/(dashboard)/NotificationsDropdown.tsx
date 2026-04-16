'use client';

import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { DeleteOutlineIcon, NotificationsRoundedIcon } from '@/components/icons';

type NotificationRow = {
  id: string;
  type: 'report' | 'adoption_request' | 'delete_request' | 'delete_request_resolved';
  title: string;
  description: string;
  href: string;
  createdAt: string;
  read: boolean;
};

type NotificationsDropdownProps = {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
};

const formatDateTime = (value: string) => {
  if (!value) {
    return 'Unknown';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

export default function NotificationsDropdown({
  isOpen,
  onToggle,
  onClose,
}: NotificationsDropdownProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getAuthHeaders = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('Your session expired. Please sign in again.');
    }

    const idToken = await currentUser.getIdToken();

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    };
  };

  const loadNotifications = useEffectEvent(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError('');

      const headers = await getAuthHeaders();
      const response = await fetch('/api/notifications', { headers });
      const data = (await response.json().catch(() => null)) as
        | { notifications?: NotificationRow[]; unreadCount?: number; error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to load notifications.');
        return;
      }

      setNotifications(data?.notifications ?? []);
      setUnreadCount(data?.unreadCount ?? 0);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load notifications.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        void loadNotifications();
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (auth.currentUser) {
        void loadNotifications(false);
      }
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadNotifications();
    }
  }, [isOpen]);

  const markAsRead = async (notificationId: string) => {
    const headers = await getAuthHeaders();
    await fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
      method: 'PATCH',
      headers,
    });
  };

  const visibleNotifications = useMemo(
    () => (filter === 'unread' ? notifications.filter((notification) => !notification.read) : notifications),
    [filter, notifications]
  );

  const updateNotificationsBulk = async (action: 'read' | 'delete', notificationIds: string[]) => {
    const headers = await getAuthHeaders();
    const response = await fetch('/api/notifications/bulk', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, notificationIds }),
    });

    if (!response.ok) {
      throw new Error('Failed to update notifications.');
    }
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((notification) => !notification.read).map((notification) => notification.id);
    if (unreadIds.length === 0) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      await updateNotificationsBulk('read', unreadIds);
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
      setUnreadCount(0);
    } catch (markError) {
      console.error(markError);
      setError('Failed to mark notifications as read.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearVisible = async () => {
    const visibleIds = visibleNotifications.map((notification) => notification.id);
    if (visibleIds.length === 0) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      await updateNotificationsBulk('delete', visibleIds);
      setNotifications((current) => current.filter((notification) => !visibleIds.includes(notification.id)));
      setUnreadCount((current) =>
        Math.max(current - visibleNotifications.filter((notification) => !notification.read).length, 0)
      );
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to clear notifications.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenNotification = async (notification: NotificationRow) => {
    try {
      await markAsRead(notification.id);
      setNotifications((current) =>
        current.map((row) => (row.id === notification.id ? { ...row, read: true } : row))
      );
      setUnreadCount((current) => Math.max(current - (notification.read ? 0 : 1), 0));
    } catch (readError) {
      console.error(readError);
    } finally {
      onClose();
      router.push(notification.href);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        setError('Failed to delete notification.');
        return;
      }

      setNotifications((current) => {
        const target = current.find((row) => row.id === notificationId);
        if (target && !target.read) {
          setUnreadCount((count) => Math.max(count - 1, 0));
        }

        return current.filter((row) => row.id !== notificationId);
      });
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to delete notification.');
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="relative flex h-11 w-11 items-center justify-center rounded-[10px] bg-transparent text-slate-700 transition hover:bg-slate-100"
        aria-label="Open notifications"
      >
        <NotificationsRoundedIcon sx={{ fontSize: 21 }} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 mt-3 w-[320px] overflow-hidden rounded-[12px] bg-white shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              <p className="text-xs text-slate-500">Reports and requests needing attention.</p>
            </div>
            <span className="rounded-[9px] bg-warning/20 px-2 py-1 text-[11px] font-semibold text-amber-900">
              {unreadCount} unread
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 px-2 py-1 shadow-[0_8px_18px_rgba(15,23,42,0.035)]">
            <div className="flex w-fit rounded-[6px] bg-slate-100 p-[2px]">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`rounded-[5px] px-1.5 py-0 text-[9px] font-semibold leading-4 transition ${
                  filter === 'all' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`rounded-[5px] px-1.5 py-0 text-[9px] font-semibold leading-4 transition ${
                  filter === 'unread' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
                }`}
              >
                Unread
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                disabled={saving || unreadCount === 0}
                className="rounded-[5px] px-1 py-0 text-[9px] font-semibold leading-4 text-primary transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Read
              </button>
              <button
                type="button"
                onClick={() => void handleClearVisible()}
                disabled={saving || visibleNotifications.length === 0}
                className="rounded-[5px] px-1 py-0 text-[9px] font-semibold leading-4 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-[330px] overflow-y-auto p-1.5">
            {loading ? (
              <div className="rounded-[8px] bg-slate-50 p-3 text-xs text-slate-500">
                Loading notifications...
              </div>
            ) : null}

            {error ? (
              <div className="rounded-[8px] bg-red-50 p-2.5 text-xs text-red-700">
                {error}
              </div>
            ) : null}

            {!loading && !error && visibleNotifications.length === 0 ? (
              <div className="rounded-[8px] bg-slate-50 p-3 text-xs text-slate-500">
                {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
              </div>
            ) : null}

            <div className="space-y-1">
              {visibleNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`group flex items-start gap-1.5 rounded-[8px] p-2 transition hover:bg-slate-50 ${
                    notification.read ? 'bg-white' : 'bg-blue-50/70'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void handleOpenNotification(notification)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className={`text-xs text-slate-900 ${notification.read ? 'font-medium' : 'font-bold'}`}>
                      {notification.title}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{notification.description}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{formatDateTime(notification.createdAt)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteNotification(notification.id)}
                    className="mt-0.5 rounded-[8px] p-1 text-slate-400 opacity-80 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    aria-label="Delete notification"
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
