import {
  activityLogsUrl,
  normalizeActivityLog,
  requireActivityLogAccess,
  type ActivityLogRecord,
} from './utils';

export async function GET(request: Request) {
  try {
    const verified = await requireActivityLogAccess(request);
    if ('error' in verified) {
      return verified.error;
    }

    const response = await fetch(
      `${activityLogsUrl}/activityLogs.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to load activity logs.' }, { status: response.status });
    }

    const data = (await response.json()) as Record<string, ActivityLogRecord> | null;
    const logs = Object.entries(data ?? {})
      .map(([id, log]) => normalizeActivityLog(id, log))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return Response.json({ logs });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load activity logs.' }, { status: 500 });
  }
}
