'use client';

import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { AdminRole } from '@/lib/auth/types';
import { auth } from '@/lib/firebase';
import { AssessmentRoundedIcon, SaveRoundedIcon } from '@/components/icons';

type ReportModule = 'all' | 'users' | 'pets' | 'adoption' | 'donation' | 'reports' | 'activity';

type CountRow = {
  label: string;
  value: number;
};

type GeneralReport = {
  generatedAt: string;
  filters: {
    module: ReportModule;
    periodLabel: string;
  };
  role: AdminRole;
  summary: {
    users: number;
    pets: number;
    shelterPets: number;
    adoptedPets: number;
    donations: number;
    donationAmount: number;
    reports: number;
    missingReports: number;
    foundReports: number;
    adoptionRequests: number;
    completedAdoptions: number;
    pendingDeleteRequests: number;
    activityLogs: number;
  };
  sections: {
    users: { total: number };
    pets: { total: number; byType: CountRow[] };
    adoption: {
      shelterPets: number;
      adoptedPets: number;
      completedInRange: number;
      pendingRequests: number;
      byType: CountRow[];
    };
    donation: { count: number; totalAmount: number; byPlatform: CountRow[] };
    reports: { total: number; byType: CountRow[]; byStatus: CountRow[] };
    activity: null | {
      total: number;
      recent: Array<{
        id: string;
        description: string;
        actor: string;
        createdAt: string;
      }>;
    };
  };
};

const isErrorResponse = (value: unknown): value is { error?: string } =>
  value !== null && typeof value === 'object' && 'error' in value;

const moduleOptions: Array<{ value: ReportModule; label: string; superOnly?: boolean }> = [
  { value: 'all', label: 'All Modules' },
  { value: 'users', label: 'Users' },
  { value: 'pets', label: 'Pets' },
  { value: 'adoption', label: 'Adoption' },
  { value: 'donation', label: 'Donation' },
  { value: 'reports', label: 'Missing/Found Reports' },
  { value: 'activity', label: 'Admin Activity', superOnly: true },
];

const formatPeso = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value || 'Unknown';
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

function CountTable({ title, rows, totalLabel = 'Total' }: { title: string; rows: CountRow[]; totalLabel?: string }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
        {title}
      </Typography>
      <TableContainer sx={{ borderRadius: 2, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Label</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Count
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length > 0 ? (
              <>
                {rows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell align="right">{row.value.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>{totalLabel}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    {total.toLocaleString()}
                  </TableCell>
                </TableRow>
              </>
            ) : (
              <TableRow>
                <TableCell colSpan={2}>
                  <Box py={2} textAlign="center">
                    <Typography variant="body2" color="text.secondary">
                      No records found.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function PrintCountTable({ title, rows, totalLabel = 'Total' }: { title: string; rows: CountRow[]; totalLabel?: string }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <section className="fd-print-section">
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Label</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            <>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.value.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="fd-print-total-row">
                <td>{totalLabel}</td>
                <td>{total.toLocaleString()}</td>
              </tr>
            </>
          ) : (
            <tr>
              <td colSpan={2}>No records found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export default function GeneralReportsSection({ adminRole }: { adminRole: AdminRole }) {
  const [module, setModule] = useState<ReportModule>('all');
  const [report, setReport] = useState<GeneralReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const visibleModuleOptions = useMemo(
    () => moduleOptions.filter((option) => !option.superOnly || adminRole === 'super_admin'),
    [adminRole]
  );

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

  const generateReport = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      params.set('module', module);

      const response = await fetch(`/api/general-reports?${params.toString()}`, { headers });
      const data = (await response.json().catch(() => null)) as GeneralReport | { error?: string } | null;

      if (!response.ok || !data || isErrorResponse(data)) {
        setError(isErrorResponse(data) ? data.error || 'Failed to generate the report.' : 'Failed to generate the report.');
        return;
      }

      setReport(data);
    } catch (generateError) {
      console.error(generateError);
      setError('Failed to generate the report.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void generateReport();
  }, []);

  const summaryCards = useMemo(() => {
    if (!report) {
      return [];
    }

    const generatedModule = report.filters.module;
    const cards = {
      users: [
        { label: 'Users', value: report.summary.users.toLocaleString() },
      ],
      pets: [
        { label: 'Total Pets', value: report.summary.pets.toLocaleString() },
      ],
      adoption: [
        { label: 'Total Adoption Records', value: (report.summary.shelterPets + report.summary.adoptedPets).toLocaleString() },
        { label: 'Shelter Pets', value: report.summary.shelterPets.toLocaleString() },
        { label: 'Adopted Pets', value: report.summary.adoptedPets.toLocaleString() },
        { label: 'Adoption Requests', value: report.summary.adoptionRequests.toLocaleString() },
      ],
      donation: [
        { label: 'Donation Records', value: report.summary.donations.toLocaleString() },
        { label: 'Donation Amount', value: formatPeso(report.summary.donationAmount) },
      ],
      reports: [
        { label: 'Reports', value: report.summary.reports.toLocaleString() },
        { label: 'Missing Reports', value: report.summary.missingReports.toLocaleString() },
        { label: 'Found Reports', value: report.summary.foundReports.toLocaleString() },
      ],
      activity: [
        { label: 'Admin Activity Logs', value: report.summary.activityLogs.toLocaleString() },
      ],
      requests: [
        { label: 'Pending Delete Requests', value: report.summary.pendingDeleteRequests.toLocaleString() },
      ],
    };

    if (generatedModule === 'all') {
      return [
        ...cards.users,
        ...cards.pets,
        { label: 'Donations', value: formatPeso(report.summary.donationAmount) },
        { label: 'Reports', value: report.summary.reports.toLocaleString() },
        ...cards.adoption.slice(2, 3),
        ...cards.requests,
      ];
    }

    if (generatedModule === 'adoption') {
      return cards.adoption;
    }

    if (generatedModule === 'activity') {
      return cards.activity;
    }

    return cards[generatedModule] ?? [];
  }, [report]);

  const generatedModuleLabel = report
    ? visibleModuleOptions.find((option) => option.value === report.filters.module)?.label ?? 'All Modules'
    : 'All Modules';

  return (
    <Stack spacing={2} className="fd-report-page">
      <Paper
        elevation={0}
        className="fd-animate-fade-up fd-screen-report"
        sx={{
          p: { xs: 1.5, md: 2 },
          borderRadius: 2.5,
          boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} justifyContent="space-between">
          <Box>
            <Typography variant="h6" fontWeight={700}>
              General Reports
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Generate a current-month operational summary from users, pets, donations, adoptions, reports, and admin activity.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
            <FormControl size="small" sx={{ minWidth: 190 }}>
              <InputLabel>Module</InputLabel>
              <Select label="Module" value={module} onChange={(event) => setModule(event.target.value as ReportModule)}>
                {visibleModuleOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<AssessmentRoundedIcon sx={{ fontSize: 18 }} />}
              onClick={() => void generateReport()}
              disabled={loading}
            >
              Generate
            </Button>
            <Button
              variant="outlined"
              startIcon={<SaveRoundedIcon sx={{ fontSize: 18 }} />}
              onClick={() => window.print()}
              disabled={!report}
            >
              Print
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2.5, textAlign: 'center' }}>
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Generating report...
          </Typography>
        </Paper>
      ) : null}

      {report ? (
        <Stack spacing={2} className="fd-screen-report">
          <Grid container spacing={1.5}>
            {summaryCards.map((card, index) => (
              <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 4 }}>
                <Paper
                  elevation={0}
                  className="fd-animate-fade-up"
                  sx={{
                    p: 1.75,
                    borderRadius: 2.5,
                    boxShadow: '0 14px 32px rgba(15, 23, 42, 0.07)',
                    animationDelay: `${index * 70}ms`,
                  }}
                >
                  <Typography variant="body2" color="text.secondary" fontWeight={650}>
                    {card.label}
                  </Typography>
                  <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
                    {card.value}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper
            elevation={0}
            className="fd-animate-fade-up"
            sx={{
              p: { xs: 1.5, md: 2 },
              borderRadius: 2.5,
              boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  Report Snapshot
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Generated {formatDateTime(report.generatedAt)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" label={`Module: ${generatedModuleLabel}`} />
                <Chip size="small" label={`Current month: ${report.filters.periodLabel}`} />
              </Stack>
            </Stack>
          </Paper>

          <Grid container spacing={1.5}>
            {(report.filters.module === 'all' || report.filters.module === 'pets') ? (
              <Grid size={{ xs: 12, lg: 6 }}>
                <CountTable title="Pet Type Quantity" rows={report.sections.pets.byType} totalLabel="Total Pets" />
              </Grid>
            ) : null}

            {(report.filters.module === 'all' || report.filters.module === 'adoption') ? (
              <Grid size={{ xs: 12, lg: 6 }}>
                <CountTable title="Adoption Pet Type Quantity" rows={report.sections.adoption.byType} totalLabel="Total Adoption Records" />
              </Grid>
            ) : null}

            {(report.filters.module === 'all' || report.filters.module === 'donation') ? (
              <Grid size={{ xs: 12, lg: 6 }}>
                <CountTable title="Donation Platforms" rows={report.sections.donation.byPlatform} />
              </Grid>
            ) : null}

            {(report.filters.module === 'all' || report.filters.module === 'reports') ? (
              <Grid size={{ xs: 12, lg: 6 }}>
                <CountTable title="Report Status" rows={report.sections.reports.byStatus} />
              </Grid>
            ) : null}
          </Grid>

          {report.sections.activity && (report.filters.module === 'all' || report.filters.module === 'activity') ? (
            <Paper
              elevation={0}
              className="fd-animate-fade-up"
              sx={{
                p: { xs: 1.5, md: 2 },
                borderRadius: 2.5,
                boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
              }}
            >
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                Recent Admin Activity
              </Typography>
              <TableContainer sx={{ borderRadius: 2, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Activity</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Admin</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.sections.activity.recent.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell>{activity.description}</TableCell>
                        <TableCell>{activity.actor}</TableCell>
                        <TableCell>{formatDateTime(activity.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          ) : null}
        </Stack>
      ) : null}

      {report ? (
        <article className="fd-print-report">
          <header className="fd-print-header">
            <div className="fd-print-brand-row">
              <Image
                src="/A4 - 1 (2).png"
                alt="Fur-Dentity logo"
                width={46}
                height={46}
                className="fd-print-logo"
              />
            </div>
            <p className="fd-print-kicker">Fur-Dentity Admin</p>
            <h1>General Report</h1>
            <p className="fd-print-module-label">{generatedModuleLabel}</p>
            <p>
              This report summarizes {generatedModuleLabel.toLowerCase()} records for {report.filters.periodLabel}.
              It was generated on {formatDateTime(report.generatedAt)} by a{' '}
              {report.role === 'super_admin' ? 'super administrator' : 'system administrator'} account.
            </p>
          </header>

          <section className="fd-print-section">
            <h2>Report Snapshot</h2>
            <table>
              <tbody>
                <tr>
                  <th>Module</th>
                  <td>{generatedModuleLabel}</td>
                </tr>
                <tr>
                  <th>Period</th>
                  <td>{report.filters.periodLabel}</td>
                </tr>
                <tr>
                  <th>Generated At</th>
                  <td>{formatDateTime(report.generatedAt)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="fd-print-section">
            <h2>Summary</h2>
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {summaryCards.map((card) => (
                  <tr key={card.label}>
                    <td>{card.label}</td>
                    <td>{card.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {report.filters.module === 'all' || report.filters.module === 'pets' ? (
            <PrintCountTable title="Pet Type Quantity" rows={report.sections.pets.byType} totalLabel="Total Pets" />
          ) : null}

          {report.filters.module === 'all' || report.filters.module === 'adoption' ? (
            <PrintCountTable title="Adoption Pet Type Quantity" rows={report.sections.adoption.byType} totalLabel="Total Adoption Records" />
          ) : null}

          {report.filters.module === 'all' || report.filters.module === 'donation' ? (
            <PrintCountTable title="Donation Platforms" rows={report.sections.donation.byPlatform} />
          ) : null}

          {report.filters.module === 'all' || report.filters.module === 'reports' ? (
            <PrintCountTable title="Report Status" rows={report.sections.reports.byStatus} />
          ) : null}

          {report.sections.activity && (report.filters.module === 'all' || report.filters.module === 'activity') ? (
            <section className="fd-print-section">
              <h2>Recent Admin Activity</h2>
              <table className="fd-print-activity-table">
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Admin</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sections.activity.recent.length > 0 ? (
                    report.sections.activity.recent.map((activity) => (
                      <tr key={activity.id}>
                        <td>{activity.description}</td>
                        <td>{activity.actor}</td>
                        <td>{formatDateTime(activity.createdAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3}>No recent admin activity found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          ) : null}
        </article>
      ) : null}
    </Stack>
  );
}
