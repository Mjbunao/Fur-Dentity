import {
  databaseUrl,
  decodeReportKey,
  formatDateTime,
  formatDirectoryName,
  getUserFullName,
  requireVerifiedAdmin,
  type ReportDeleteRequestRecord,
  type TicketRecord,
  type UserRecord,
} from '../utils';
import { createActivityLog } from '@/lib/audit/activity-log';

type DeleteRequestPayload = {
  reportKey?: string;
  reportId?: string;
  mainDir?: string;
  subDir?: string;
  reportType?: 'found' | 'missing' | 'other';
  petName?: string;
  reportStatus?: 'Pending' | 'Received' | 'Processing' | 'Rejected' | 'Finished';
  requestedByUid?: string;
  requestedByName?: string;
  requestedByEmail?: string;
};

const getReporter = async (report: TicketRecord, idToken: string) => {
  const reporterId = report.submittedByUID || report.submittedBy || '';

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

export async function GET(request: Request) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    if (verified.session.role !== 'super_admin') {
      return Response.json({ error: 'Only super admins can view report delete requests.' }, { status: 403 });
    }

    const response = await fetch(
      `${databaseUrl}/reportDeleteRequests.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to load report delete requests.' }, { status: response.status });
    }

    const data = (await response.json()) as Record<string, ReportDeleteRequestRecord> | null;
    const requests = Object.entries(data ?? {})
      .filter(([, row]) => row.status === 'pending')
      .map(([id, row]) => {
        const decoded = row.reportKey ? decodeReportKey(row.reportKey) : null;
        const mainDir = row.mainDir || decoded?.mainDir || '';
        const subDir = row.subDir || decoded?.subDir || '';

        return {
          id,
          reportKey: row.reportKey || '',
          reportId: row.reportId || decoded?.reportId || '',
          mainDir,
          subDir,
          reportType: row.reportType || formatDirectoryName(mainDir),
          petName: row.petName || 'Unknown pet',
          reportStatus: row.reportStatus || 'Pending',
          requestedByUid: row.requestedByUid || '',
          requestedByName: row.requestedByName || 'Unknown admin',
          requestedByEmail: row.requestedByEmail || 'No email',
          status: row.status || 'pending',
          createdAt: formatDateTime(row.createdAt),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return Response.json({ requests });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load report delete requests.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    if (verified.session.role !== 'system_admin') {
      return Response.json({ error: 'Only system admins can request report deletion.' }, { status: 403 });
    }

    const body = (await request.json()) as DeleteRequestPayload;
    if (!body.reportKey || !body.petName) {
      return Response.json({ error: 'Report information is required for a delete request.' }, { status: 400 });
    }

    const decoded = decodeReportKey(body.reportKey);
    if (!decoded) {
      return Response.json({ error: 'Invalid report key.' }, { status: 400 });
    }

    const reportResponse = await fetch(
      `${databaseUrl}/tickets/${decoded.mainDir}/${decoded.subDir}/${decoded.reportId}.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!reportResponse.ok) {
      return Response.json({ error: 'Failed to validate report record.' }, { status: reportResponse.status });
    }

    const reportRecord = (await reportResponse.json()) as TicketRecord | null;
    if (!reportRecord) {
      return Response.json({ error: 'Report record not found.' }, { status: 404 });
    }

    if (reportRecord.requestStatus === 'pending') {
      return Response.json({ error: 'A pending delete request already exists for this report.' }, { status: 409 });
    }

    const payload: ReportDeleteRequestRecord = {
      reportKey: body.reportKey,
      reportId: body.reportId || decoded.reportId,
      mainDir: body.mainDir || decoded.mainDir,
      subDir: body.subDir || decoded.subDir,
      reportType: body.reportType || 'other',
      petName: body.petName,
      reportStatus: body.reportStatus || 'Pending',
      requestedByUid: body.requestedByUid || verified.session.uid,
      requestedByName: body.requestedByName || verified.session.name || 'System Admin',
      requestedByEmail: body.requestedByEmail || verified.session.email,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const requestResponse = await fetch(
      `${databaseUrl}/reportDeleteRequests.json?auth=${encodeURIComponent(verified.idToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      }
    );

    if (!requestResponse.ok) {
      return Response.json({ error: 'Failed to create report delete request.' }, { status: requestResponse.status });
    }

    const createdRequest = (await requestResponse.json()) as { name?: string } | null;
    if (!createdRequest?.name) {
      return Response.json({ error: 'Delete request was created but its ID was not returned.' }, { status: 500 });
    }

    const statusResponse = await fetch(
      `${databaseUrl}/tickets/${decoded.mainDir}/${decoded.subDir}/${decoded.reportId}.json?auth=${encodeURIComponent(verified.idToken)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestStatus: 'pending',
          deleteRequestId: createdRequest.name,
          deleteRequestByUid: verified.session.uid,
        }),
        cache: 'no-store',
      }
    );

    if (!statusResponse.ok) {
      return Response.json({ error: 'Delete request was created but report status could not be updated.' }, { status: statusResponse.status });
    }

    const reporter = await getReporter(reportRecord, verified.idToken);
    const reportType = body.reportType || formatDirectoryName(decoded.mainDir);

    await createActivityLog({
      session: verified.session,
      idToken: verified.idToken,
      log: {
        action: 'requested_delete',
        module: 'reports',
        subject: {
          type: 'user',
          id: reporter.id,
          name: reporter.name,
        },
        target: {
          type: 'report',
          id: body.reportKey,
          name: `${reportType} report for ${body.petName}`,
        },
        description: `${verified.session.name || verified.session.email} requested deletion of ${reporter.name}'s ${reportType} report for ${body.petName}.`,
        metadata: {
          requestId: createdRequest.name,
          reportType,
          petName: body.petName,
          status: body.reportStatus || 'Pending',
        },
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create report delete request.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    if (verified.session.role !== 'system_admin') {
      return Response.json({ error: 'Only system admins can cancel report delete requests.' }, { status: 403 });
    }

    const body = (await request.json()) as { reportKey?: string };
    if (!body.reportKey) {
      return Response.json({ error: 'Report key is required to cancel a delete request.' }, { status: 400 });
    }

    const decoded = decodeReportKey(body.reportKey);
    if (!decoded) {
      return Response.json({ error: 'Invalid report key.' }, { status: 400 });
    }

    const reportResponse = await fetch(
      `${databaseUrl}/tickets/${decoded.mainDir}/${decoded.subDir}/${decoded.reportId}.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!reportResponse.ok) {
      return Response.json({ error: 'Failed to validate report record.' }, { status: reportResponse.status });
    }

    const reportRecord = (await reportResponse.json()) as TicketRecord | null;
    if (!reportRecord || reportRecord.requestStatus !== 'pending' || !reportRecord.deleteRequestId) {
      return Response.json({ error: 'No cancellable pending delete request was found for this report.' }, { status: 404 });
    }

    if (reportRecord.deleteRequestByUid && reportRecord.deleteRequestByUid !== verified.session.uid) {
      return Response.json({ error: 'You can only cancel your own pending report delete request.' }, { status: 403 });
    }

    const [deleteRequestResponse, clearStatusResponse] = await Promise.all([
      fetch(
        `${databaseUrl}/reportDeleteRequests/${encodeURIComponent(reportRecord.deleteRequestId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
        { method: 'DELETE', cache: 'no-store' }
      ),
      fetch(
        `${databaseUrl}/tickets/${decoded.mainDir}/${decoded.subDir}/${decoded.reportId}.json?auth=${encodeURIComponent(verified.idToken)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestStatus: null,
            deleteRequestId: null,
            deleteRequestByUid: null,
          }),
          cache: 'no-store',
        }
      ),
    ]);

    if (!deleteRequestResponse.ok || !clearStatusResponse.ok) {
      return Response.json({ error: 'Failed to cancel report delete request.' }, { status: 500 });
    }

    const reporter = await getReporter(reportRecord, verified.idToken);
    const reportType = formatDirectoryName(decoded.mainDir);
    const petName = reportRecord.petName || reportRecord.petID || 'Unknown pet';

    await createActivityLog({
      session: verified.session,
      idToken: verified.idToken,
      log: {
        action: 'canceled_delete_request',
        module: 'reports',
        subject: {
          type: 'user',
          id: reporter.id,
          name: reporter.name,
        },
        target: {
          type: 'report',
          id: body.reportKey,
          name: `${reportType} report for ${petName}`,
        },
        description: `${verified.session.name || verified.session.email} canceled the delete request for ${reporter.name}'s ${reportType} report for ${petName}.`,
        metadata: {
          requestId: reportRecord.deleteRequestId,
          reportType,
          petName,
        },
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to cancel report delete request.' }, { status: 500 });
  }
}
