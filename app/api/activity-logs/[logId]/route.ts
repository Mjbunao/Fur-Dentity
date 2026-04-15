import {
  activityLogsUrl,
  normalizeActivityLog,
  requireActivityLogAccess,
  type ActivityLogRecord,
} from '../utils';

type RouteContext = {
  params: Promise<{
    logId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const verified = await requireActivityLogAccess(request);
    if ('error' in verified) {
      return verified.error;
    }

    const { logId } = await context.params;
    const response = await fetch(
      `${activityLogsUrl}/activityLogs/${encodeURIComponent(logId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to load activity log.' }, { status: response.status });
    }

    const log = (await response.json()) as ActivityLogRecord | null;
    if (!log) {
      return Response.json({ error: 'Activity log not found.' }, { status: 404 });
    }

    return Response.json({ log: normalizeActivityLog(logId, log) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load activity log.' }, { status: 500 });
  }
}
