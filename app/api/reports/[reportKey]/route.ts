import {
  buildReportRow,
  databaseUrl,
  decodeReportKey,
  formatDirectoryName,
  getUserFullName,
  normalizeStatus,
  requireVerifiedAdmin,
  type PetRecord,
  type ReportStatus,
  type TicketRecord,
  type UserRecord,
} from '../utils';
import { createActivityLog } from '@/lib/audit/activity-log';

type RouteContext = {
  params: Promise<{
    reportKey: string;
  }>;
};

const statuses: ReportStatus[] = ['Pending', 'Received', 'Processing', 'Rejected', 'Finished'];

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

const getReportPetName = async (report: TicketRecord, idToken: string) => {
  if (report.petName) {
    return report.petName;
  }

  const petId = report.petID?.trim();
  if (!petId) {
    return 'Unknown pet';
  }

  const response = await fetch(
    `${databaseUrl}/pets/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(idToken)}`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    return petId;
  }

  const pet = (await response.json()) as PetRecord | null;
  return pet?.petDetails?.petName || petId;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const { reportKey } = await context.params;
    const decoded = decodeReportKey(reportKey);
    if (!decoded) {
      return Response.json({ error: 'Invalid report key.' }, { status: 400 });
    }

    const ticketResponse = await fetch(
      `${databaseUrl}/tickets/${decoded.mainDir}/${decoded.subDir}/${decoded.reportId}.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!ticketResponse.ok) {
      return Response.json({ error: 'Failed to load report.' }, { status: ticketResponse.status });
    }

    const report = (await ticketResponse.json()) as TicketRecord | null;
    if (!report) {
      return Response.json({ error: 'Report not found.' }, { status: 404 });
    }

    const reporterId = report.submittedByUID || report.submittedBy || '';
    const petId = report.petID?.trim() || '';
    const [userResponse, petResponse] = await Promise.all([
      reporterId
        ? fetch(`${databaseUrl}/users/${encodeURIComponent(reporterId)}.json?auth=${encodeURIComponent(verified.idToken)}`, {
            cache: 'no-store',
          })
        : Promise.resolve(null),
      petId
        ? fetch(`${databaseUrl}/pets/${encodeURIComponent(petId)}.json?auth=${encodeURIComponent(verified.idToken)}`, {
            cache: 'no-store',
          })
        : Promise.resolve(null),
    ]);

    const reporter = userResponse?.ok ? ((await userResponse.json()) as UserRecord | null) : null;
    const pet = petResponse?.ok ? ((await petResponse.json()) as PetRecord | null) : null;

    const markOpenedResponse = await fetch(
      `${databaseUrl}/tickets/${decoded.mainDir}/${decoded.subDir}/${decoded.reportId}/openedAt.json?auth=${encodeURIComponent(verified.idToken)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Date.now()),
        cache: 'no-store',
      }
    );

    if (!markOpenedResponse.ok) {
      console.warn('Failed to mark report opened.', markOpenedResponse.status);
    }

    return Response.json({
      report: buildReportRow({
        mainDir: decoded.mainDir,
        subDir: decoded.subDir,
        reportId: decoded.reportId,
        report: { ...report, openedAt: report.openedAt || Date.now() },
        reporter,
        pet,
      }),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load report.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const { reportKey } = await context.params;
    const decoded = decodeReportKey(reportKey);
    if (!decoded) {
      return Response.json({ error: 'Invalid report key.' }, { status: 400 });
    }

    const ticketResponse = await fetch(
      `${databaseUrl}/tickets/${decoded.mainDir}/${decoded.subDir}/${decoded.reportId}.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!ticketResponse.ok) {
      return Response.json({ error: 'Failed to load report before update.' }, { status: ticketResponse.status });
    }

    const currentReport = (await ticketResponse.json()) as TicketRecord | null;
    if (!currentReport) {
      return Response.json({ error: 'Report not found.' }, { status: 404 });
    }

    const body = (await request.json()) as { status?: ReportStatus };
    const status = normalizeStatus(body.status);
    if (!statuses.includes(status)) {
      return Response.json({ error: 'Invalid report status.' }, { status: 400 });
    }

    const updateData: Record<string, string> = { status };

    if (status === 'Finished') {
      updateData.finishedAt = new Date().toISOString();
    }

    if (status === 'Rejected') {
      updateData.rejectedAt = new Date().toISOString();
    }

    const response = await fetch(
      `${databaseUrl}/tickets/${decoded.mainDir}/${decoded.subDir}/${decoded.reportId}.json?auth=${encodeURIComponent(verified.idToken)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to update report status.' }, { status: response.status });
    }

    const reporter = await getReporter(currentReport, verified.idToken);
    const reportType = formatDirectoryName(decoded.mainDir);
    const petName = await getReportPetName(currentReport, verified.idToken);
    const previousStatus = normalizeStatus(currentReport.status);

    await createActivityLog({
      session: verified.session,
      idToken: verified.idToken,
      log: {
        action: 'updated_report_status',
        module: 'reports',
        subject: {
          type: 'user',
          id: reporter.id,
          name: reporter.name,
        },
        target: {
          type: 'report',
          id: reportKey,
          name: `${reportType} report for ${petName}`,
        },
        description: `${verified.session.name || verified.session.email} updated ${reporter.name}'s ${reportType} report for ${petName} from ${previousStatus} to ${status}.`,
        metadata: {
          reportType,
          petName,
          previousStatus,
          newStatus: status,
        },
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update report status.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    if (verified.session.role !== 'super_admin') {
      return Response.json({ error: 'Only super admins can delete reports.' }, { status: 403 });
    }

    const { reportKey } = await context.params;
    const decoded = decodeReportKey(reportKey);
    if (!decoded) {
      return Response.json({ error: 'Invalid report key.' }, { status: 400 });
    }

    const ticketResponse = await fetch(
      `${databaseUrl}/tickets/${decoded.mainDir}/${decoded.subDir}/${decoded.reportId}.json?auth=${encodeURIComponent(verified.idToken)}`,
      { cache: 'no-store' }
    );

    if (!ticketResponse.ok) {
      return Response.json({ error: 'Failed to load report before deletion.' }, { status: ticketResponse.status });
    }

    const reportRecord = (await ticketResponse.json()) as TicketRecord | null;
    if (!reportRecord) {
      return Response.json({ error: 'Report not found.' }, { status: 404 });
    }

    const response = await fetch(
      `${databaseUrl}/tickets/${decoded.mainDir}/${decoded.subDir}/${decoded.reportId}.json?auth=${encodeURIComponent(verified.idToken)}`,
      {
        method: 'DELETE',
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return Response.json({ error: 'Failed to delete report.' }, { status: response.status });
    }

    if (reportRecord.requestStatus === 'pending' && reportRecord.deleteRequestId) {
      const requestCleanupResponse = await fetch(
        `${databaseUrl}/reportDeleteRequests/${encodeURIComponent(reportRecord.deleteRequestId)}.json?auth=${encodeURIComponent(verified.idToken)}`,
        {
          method: 'DELETE',
          cache: 'no-store',
        }
      );

      if (!requestCleanupResponse.ok) {
        console.warn('Failed to clean up report delete request.', requestCleanupResponse.status);
      }
    }

    const reporter = await getReporter(reportRecord, verified.idToken);
    const reportType = formatDirectoryName(decoded.mainDir);
    const petName = await getReportPetName(reportRecord, verified.idToken);

    await createActivityLog({
      session: verified.session,
      idToken: verified.idToken,
      log: {
        action: 'deleted_report',
        module: 'reports',
        subject: {
          type: 'user',
          id: reporter.id,
          name: reporter.name,
        },
        target: {
          type: 'report',
          id: reportKey,
          name: `${reportType} report for ${petName}`,
        },
        description: `${verified.session.name || verified.session.email} directly deleted ${reporter.name}'s ${reportType} report for ${petName}.`,
        metadata: {
          reportType,
          petName,
          status: normalizeStatus(reportRecord.status),
        },
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete report.' }, { status: 500 });
  }
}
