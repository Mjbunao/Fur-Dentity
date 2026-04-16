import {
  databaseUrl,
  decodeReportKey,
  formatDirectoryName,
  getUserFullName,
  requireVerifiedAdmin,
  type ReportDeleteRequestRecord,
  type TicketRecord,
  type UserRecord,
} from '../../utils';
import { createActivityLog } from '@/lib/audit/activity-log';
import { createAdminNotification } from '@/lib/notifications/admin-notification';

type RouteContext = {
  params: Promise<{
    requestId: string;
  }>;
};

const getReporter = async (report: TicketRecord | null, idToken: string) => {
  const reporterId = report?.submittedByUID || report?.submittedBy || '';

  if (!reporterId) {
    return { id: '', name: 'Unknown Reporter' };
  }

  const response = await fetch(
    `${databaseUrl}/users/${encodeURIComponent(reporterId)}.json?auth=${encodeURIComponent(idToken)}`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    return { id: reporterId, name: 'Unknown Reporter' };
  }

  return {
    id: reporterId,
    name: getUserFullName((await response.json()) as UserRecord | null),
  };
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    if (verified.session.role !== 'super_admin') {
      return Response.json({ error: 'Only super admins can resolve report delete requests.' }, { status: 403 });
    }

    const { action } = (await request.json()) as { action?: 'approve' | 'reject' };
    if (action !== 'approve' && action !== 'reject') {
      return Response.json({ error: 'Action must be approve or reject.' }, { status: 400 });
    }

    const { requestId } = await context.params;
    const requestResponse = await fetch(
      `${databaseUrl}/reportDeleteRequests/${encodeURIComponent(requestId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!requestResponse.ok) {
      return Response.json({ error: 'Failed to load report delete request.' }, { status: requestResponse.status });
    }

    const requestRecord = (await requestResponse.json()) as ReportDeleteRequestRecord | null;
    if (!requestRecord?.reportKey) {
      return Response.json({ error: 'Report delete request not found.' }, { status: 404 });
    }

    const decoded = decodeReportKey(requestRecord.reportKey);
    if (!decoded) {
      return Response.json({ error: 'Invalid report key.' }, { status: 400 });
    }

    const reportResponse = await fetch(
      `${databaseUrl}/tickets/${decoded.mainDir}/${decoded.subDir}/${decoded.reportId}.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );
    const reportRecord = reportResponse.ok ? ((await reportResponse.json()) as TicketRecord | null) : null;
    const reporter = await getReporter(reportRecord, verified.idToken);
    const reportType = requestRecord.reportType || formatDirectoryName(decoded.mainDir);
    const petName = requestRecord.petName || reportRecord?.petName || reportRecord?.petID || 'Unknown pet';

    if (action === 'approve') {
      const deleteReportResponse = await fetch(
        `${databaseUrl}/tickets/${decoded.mainDir}/${decoded.subDir}/${decoded.reportId}.json?auth=${encodeURIComponent(verified.idToken)}`,
        {
          method: 'DELETE',
          cache: 'no-store',
        }
      );

      if (!deleteReportResponse.ok) {
        return Response.json({ error: 'Failed to delete report record.' }, { status: deleteReportResponse.status });
      }

      await createActivityLog({
        session: verified.session,
        idToken: verified.idToken,
        log: {
          action: 'approved_delete_request',
          module: 'reports',
          subject: {
            type: 'user',
            id: reporter.id,
            name: reporter.name,
          },
          target: {
            type: 'report',
            id: requestRecord.reportKey,
            name: `${reportType} report for ${petName}`,
          },
          description: `${verified.session.name || verified.session.email} approved the delete request and deleted ${reporter.name}'s ${reportType} report for ${petName}.`,
          metadata: {
            requestId,
            requestedByName: requestRecord.requestedByName,
            reportType,
            petName,
          },
        },
      });

      await createAdminNotification({
        uid: requestRecord.requestedByUid,
        idToken: verified.idToken,
        notification: {
          type: 'delete_request_resolved',
          title: 'Your report delete request was approved',
          description: `${verified.session.name || verified.session.email} approved your delete request for ${petName}.`,
          href: '/reports',
        },
      });

      await createAdminNotification({
        uid: verified.session.uid,
        idToken: verified.idToken,
        notification: {
          type: 'delete_request_resolved',
          title: `${requestRecord.requestedByName || 'System Admin'} requested report deletion`,
          description: `${petName} - Request approved`,
          href: '/reports',
          read: true,
        },
      });
    } else {
      const resetStatusResponse = await fetch(
        `${databaseUrl}/tickets/${decoded.mainDir}/${decoded.subDir}/${decoded.reportId}.json?auth=${encodeURIComponent(verified.idToken)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestStatus: 'rejected',
            deleteRequestId: null,
            deleteRequestByUid: null,
          }),
          cache: 'no-store',
        }
      );

      if (!resetStatusResponse.ok) {
        return Response.json({ error: 'Failed to update report request status.' }, { status: resetStatusResponse.status });
      }

      await createActivityLog({
        session: verified.session,
        idToken: verified.idToken,
        log: {
          action: 'rejected_delete_request',
          module: 'reports',
          subject: {
            type: 'user',
            id: reporter.id,
            name: reporter.name,
          },
          target: {
            type: 'report',
            id: requestRecord.reportKey,
            name: `${reportType} report for ${petName}`,
          },
          description: `${verified.session.name || verified.session.email} rejected the delete request for ${reporter.name}'s ${reportType} report for ${petName}.`,
          metadata: {
            requestId,
            requestedByName: requestRecord.requestedByName,
            reportType,
            petName,
          },
        },
      });

      await createAdminNotification({
        uid: requestRecord.requestedByUid,
        idToken: verified.idToken,
        notification: {
          type: 'delete_request_resolved',
          title: 'Your report delete request was rejected',
          description: `${verified.session.name || verified.session.email} rejected your delete request for ${petName}.`,
          href: `/reports/${requestRecord.reportKey}`,
        },
      });

      await createAdminNotification({
        uid: verified.session.uid,
        idToken: verified.idToken,
        notification: {
          type: 'delete_request_resolved',
          title: `${requestRecord.requestedByName || 'System Admin'} requested report deletion`,
          description: `${petName} - Request rejected`,
          href: `/reports/${requestRecord.reportKey}`,
          read: true,
        },
      });
    }

    const deleteRequestResponse = await fetch(
      `${databaseUrl}/reportDeleteRequests/${encodeURIComponent(requestId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
      {
        method: 'DELETE',
        cache: 'no-store',
      }
    );

    if (!deleteRequestResponse.ok) {
      return Response.json({ error: 'Failed to remove report delete request.' }, { status: deleteRequestResponse.status });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to resolve report delete request.' }, { status: 500 });
  }
}
