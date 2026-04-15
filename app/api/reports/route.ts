import {
  buildReportRow,
  databaseUrl,
  requireVerifiedAdmin,
  type PetRecord,
  type TicketRecord,
  type UserRecord,
} from './utils';

type TicketsTree = Record<string, Record<string, Record<string, TicketRecord>>>;

export async function GET(request: Request) {
  try {
    const verified = await requireVerifiedAdmin(request);
    if ('error' in verified) {
      return verified.error;
    }

    const [ticketsResponse, usersResponse, petsResponse] = await Promise.all([
      fetch(`${databaseUrl}/tickets.json?auth=${encodeURIComponent(verified.idToken)}`, { cache: 'no-store' }),
      fetch(`${databaseUrl}/users.json?auth=${encodeURIComponent(verified.idToken)}`, { cache: 'no-store' }),
      fetch(`${databaseUrl}/pets.json?auth=${encodeURIComponent(verified.idToken)}`, { cache: 'no-store' }),
    ]);

    if (!ticketsResponse.ok) {
      return Response.json({ error: 'Failed to load reports.' }, { status: ticketsResponse.status });
    }

    if (!usersResponse.ok || !petsResponse.ok) {
      return Response.json({ error: 'Failed to load report reference data.' }, { status: 500 });
    }

    const tickets = (await ticketsResponse.json()) as TicketsTree | null;
    const users = (await usersResponse.json()) as Record<string, UserRecord> | null;
    const pets = (await petsResponse.json()) as Record<string, PetRecord> | null;

    const reports = Object.entries(tickets ?? {}).flatMap(([mainDir, subDirs]) =>
      Object.entries(subDirs ?? {}).flatMap(([subDir, records]) =>
        Object.entries(records ?? {}).map(([reportId, report]) => {
          const reporterId = report.submittedByUID || report.submittedBy || '';
          const petId = report.petID?.trim() || '';

          return buildReportRow({
            mainDir,
            subDir,
            reportId,
            report,
            reporter: users?.[reporterId],
            pet: petId ? pets?.[petId] : null,
          });
        })
      )
    );

    const currentDate = new Date();
    const totalMonthlyReports = reports.filter((report) => {
      const submittedAt = new Date(report.submittedAt);
      return (
        !Number.isNaN(submittedAt.getTime()) &&
        submittedAt.getMonth() === currentDate.getMonth() &&
        submittedAt.getFullYear() === currentDate.getFullYear()
      );
    }).length;

    const missingReports = reports.filter((report) => report.reportType === 'missing' && report.petId);
    const foundReports = reports.filter((report) => report.reportType === 'found' && report.petId);
    const matches = missingReports.flatMap((missing) =>
      foundReports
        .filter((found) => found.petId === missing.petId)
        .map((found) => ({
          id: `${missing.id}-${found.id}`,
          petId: missing.petId,
          petName: missing.petName,
          missing,
          found,
          status:
            missing.status === 'Finished' && found.status === 'Finished'
              ? 'finished'
              : 'active',
        }))
    );

    return Response.json({
      reports: reports.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
      matches,
      totalMonthlyReports,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load reports.' }, { status: 500 });
  }
}
