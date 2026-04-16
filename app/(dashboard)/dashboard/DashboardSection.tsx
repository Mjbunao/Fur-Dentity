'use client';

import Link from 'next/link';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { auth } from '@/lib/firebase';
import {
  AdminPanelSettingsIcon,
  HealthAndSafetySharpIcon,
  HistoryRoundedIcon,
  MonetizationOnSharpIcon,
  PeopleAltSharpIcon,
  PetsSharpIcon,
  ReportProblemRoundedIcon,
  WarningAmberRoundedIcon,
} from '@/components/icons';

type DashboardSummary = {
  users: number;
  pets: number;
  shelterPets: number;
  adoptedPets: number;
  reportsThisMonth: number;
  adoptionRequests: number;
  donationsThisMonth: number;
};

type DashboardQueues = {
  donationDeleteRequests: number;
  adoptionDeleteRequests: number;
  reportDeleteRequests: number;
};

type DashboardCharts = {
  missingReportsByMonth: number[];
  foundReportsByMonth: number[];
  adoptedPetsByMonth: number[];
  donationAmountByMonth: number[];
};

type ActivityLogRow = {
  id: string;
  actor: {
    name: string;
    email: string;
    role: string;
  };
  description: string;
  createdAt: string;
};

type DashboardResponse = {
  summary?: DashboardSummary;
  queues?: DashboardQueues;
  charts?: DashboardCharts;
  recentActivity?: ActivityLogRow[];
  error?: string;
};

type DashboardSectionProps = {
  adminRole: 'super_admin' | 'system_admin';
  adminName?: string;
};

const emptySummary: DashboardSummary = {
  users: 0,
  pets: 0,
  shelterPets: 0,
  adoptedPets: 0,
  reportsThisMonth: 0,
  adoptionRequests: 0,
  donationsThisMonth: 0,
};

const emptyQueues: DashboardQueues = {
  donationDeleteRequests: 0,
  adoptionDeleteRequests: 0,
  reportDeleteRequests: 0,
};

const emptyCharts: DashboardCharts = {
  missingReportsByMonth: new Array(12).fill(0),
  foundReportsByMonth: new Array(12).fill(0),
  adoptedPetsByMonth: new Array(12).fill(0),
  donationAmountByMonth: new Array(12).fill(0),
};

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatPeso = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);

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

const cardSx = {
  height: '100%',
  p: 1.75,
  borderRadius: 2.5,
  boxShadow: '0 14px 32px rgba(15, 23, 42, 0.07)',
  transition: 'transform 160ms ease, box-shadow 160ms ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 16px 35px rgba(15, 23, 42, 0.08)',
  },
};

const iconBoxSx = {
  width: 38,
  height: 38,
  borderRadius: 2,
  display: 'grid',
  placeItems: 'center',
};

const chartPaperSx = {
  p: 1.75,
  borderRadius: 2.5,
  boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
  height: '100%',
};

function MonthlySingleBarChart({
  title,
  description,
  values,
  valueFormatter = (value: number) => value.toLocaleString(),
  color = 'primary.main',
}: {
  title: string;
  description: string;
  values: number[];
  valueFormatter?: (value: number) => string;
  color?: string;
}) {
  const maxValue = Math.max(...values, 1);

  return (
    <Paper elevation={0} sx={chartPaperSx}>
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {description}
      </Typography>
      <Stack direction="row" alignItems="end" spacing={0.75} sx={{ height: 190, mt: 2 }}>
        {monthLabels.map((month, index) => {
          const value = values[index] ?? 0;

          return (
            <Stack key={month} alignItems="center" justifyContent="end" spacing={0.75} sx={{ flex: 1, height: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ minHeight: 16 }}>
                {value > 0 ? valueFormatter(value) : ''}
              </Typography>
              <Box
                title={`${month}: ${valueFormatter(value)}`}
                sx={{
                  width: '100%',
                  maxWidth: 24,
                  minHeight: value > 0 ? 8 : 3,
                  height: `${Math.max((value / maxValue) * 120, value > 0 ? 8 : 3)}px`,
                  borderRadius: '8px 8px 3px 3px',
                  bgcolor: value > 0 ? color : 'grey.200',
                  transition: 'height 180ms ease',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {month}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}

function MissingFoundChart({
  missing,
  found,
}: {
  missing: number[];
  found: number[];
}) {
  const maxValue = Math.max(...missing, ...found, 1);

  return (
    <Paper elevation={0} sx={chartPaperSx}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Missing vs Found Reports
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Monthly report count from mobile tickets.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.25}>
          <Chip size="small" label="Missing" color="primary" sx={{ borderRadius: 2 }} />
          <Chip size="small" label="Found" color="warning" sx={{ borderRadius: 2 }} />
        </Stack>
      </Stack>
      <Stack direction="row" alignItems="end" spacing={0.75} sx={{ height: 190, mt: 2 }}>
        {monthLabels.map((month, index) => {
          const missingValue = missing[index] ?? 0;
          const foundValue = found[index] ?? 0;

          return (
            <Stack key={month} alignItems="center" justifyContent="end" spacing={0.75} sx={{ flex: 1, height: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ minHeight: 16 }}>
                {missingValue || foundValue ? `${missingValue}/${foundValue}` : ''}
              </Typography>
              <Stack direction="row" alignItems="end" spacing={0.35} sx={{ height: 122 }}>
                <Box
                  title={`${month} missing: ${missingValue}`}
                  sx={{
                    width: 9,
                    minHeight: missingValue > 0 ? 8 : 3,
                    height: `${Math.max((missingValue / maxValue) * 120, missingValue > 0 ? 8 : 3)}px`,
                    borderRadius: '8px 8px 3px 3px',
                    bgcolor: missingValue > 0 ? 'primary.main' : 'grey.200',
                  }}
                />
                <Box
                  title={`${month} found: ${foundValue}`}
                  sx={{
                    width: 9,
                    minHeight: foundValue > 0 ? 8 : 3,
                    height: `${Math.max((foundValue / maxValue) * 120, foundValue > 0 ? 8 : 3)}px`,
                    borderRadius: '8px 8px 3px 3px',
                    bgcolor: foundValue > 0 ? 'warning.main' : 'grey.200',
                  }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {month}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}

export default function DashboardSection({ adminRole, adminName }: DashboardSectionProps) {
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [queues, setQueues] = useState<DashboardQueues>(emptyQueues);
  const [charts, setCharts] = useState<DashboardCharts>(emptyCharts);
  const [recentActivity, setRecentActivity] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Your session expired. Please sign in again.');
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/dashboard', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = (await response.json().catch(() => null)) as DashboardResponse | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to load dashboard.');
        return;
      }

      setSummary(data?.summary ?? emptySummary);
      setQueues(data?.queues ?? emptyQueues);
      setCharts(data?.charts ?? emptyCharts);
      setRecentActivity(data?.recentActivity ?? []);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadDashboard();
  }, []);

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total Users',
        value: summary.users.toLocaleString(),
        helper: 'Registered mobile users',
        href: '/users',
        icon: PeopleAltSharpIcon,
        tone: 'primary' as const,
      },
      {
        label: 'Registered Pets',
        value: summary.pets.toLocaleString(),
        helper: 'Pets from user records',
        href: '/pets',
        icon: PetsSharpIcon,
        tone: 'warning' as const,
      },
      {
        label: 'Shelter Pets',
        value: summary.shelterPets.toLocaleString(),
        helper: `${summary.adoptedPets.toLocaleString()} adopted pets recorded`,
        href: '/adoption',
        icon: HealthAndSafetySharpIcon,
        tone: 'primary' as const,
      },
      {
        label: 'Reports This Month',
        value: summary.reportsThisMonth.toLocaleString(),
        helper: 'Missing and found reports',
        href: '/reports',
        icon: ReportProblemRoundedIcon,
        tone: 'warning' as const,
      },
      {
        label: 'Adoption Requests',
        value: summary.adoptionRequests.toLocaleString(),
        helper: 'Pending mobile-user requests',
        href: '/adoption',
        icon: PetsSharpIcon,
        tone: 'primary' as const,
      },
      {
        label: 'Donations This Month',
        value: formatPeso(summary.donationsThisMonth),
        helper: 'Total recorded donation amount',
        href: '/donation',
        icon: MonetizationOnSharpIcon,
        tone: 'warning' as const,
      },
    ],
    [summary]
  );

  const queueCards = [
    {
      label: 'Donation Delete Requests',
      value: queues.donationDeleteRequests,
      href: '/donation',
    },
    {
      label: 'Adoption Delete Requests',
      value: queues.adoptionDeleteRequests,
      href: '/adoption',
    },
    {
      label: 'Report Delete Requests',
      value: queues.reportDeleteRequests,
      href: '/reports',
    },
  ];

  return (
      <Stack spacing={2}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.75, md: 2 },
          borderRadius: 2.5,
          boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
          background:
            'linear-gradient(135deg, rgba(0,84,255,0.10), rgba(243,165,49,0.10) 55%, rgba(255,255,255,0.98))',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Welcome back{adminName ? `, ${adminName}` : ''}. Review today’s admin metrics and pending work.
            </Typography>
          </Box>
          <Chip
            icon={<AdminPanelSettingsIcon />}
            label={adminRole.replace('_', ' ')}
            color={adminRole === 'super_admin' ? 'primary' : 'warning'}
            sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, borderRadius: 2, fontWeight: 700 }}
          />
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {loading ? (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 2.5,
            boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
            textAlign: 'center',
          }}
        >
          <CircularProgress size={28} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Loading dashboard summary...
          </Typography>
        </Paper>
      ) : (
        <>
          <Grid container spacing={1.5}>
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <Paper
                    component={Link}
                    href={card.href}
                    elevation={0}
                    sx={{
                      ...cardSx,
                      display: 'block',
                      color: 'text.primary',
                      textDecoration: 'none',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>
                          {card.label}
                        </Typography>
                        <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5 }}>
                          {card.value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          {card.helper}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          ...iconBoxSx,
                          bgcolor: card.tone === 'primary' ? 'primary.main' : 'warning.main',
                          color: card.tone === 'primary' ? 'primary.contrastText' : 'grey.900',
                        }}
                      >
                        <Icon fontSize="small" />
                      </Box>
                    </Stack>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, xl: 6 }}>
              <MissingFoundChart
                missing={charts.missingReportsByMonth}
                found={charts.foundReportsByMonth}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 3 }}>
              <MonthlySingleBarChart
                title="Adopted Pets"
                description="Completed adoptions by month."
                values={charts.adoptedPetsByMonth}
                color="primary.main"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6, xl: 3 }}>
              <MonthlySingleBarChart
                title="Donation Amount"
                description="Recorded donation amount by month."
                values={charts.donationAmountByMonth}
                valueFormatter={formatPeso}
                color="warning.main"
              />
            </Grid>
          </Grid>

          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, lg: adminRole === 'super_admin' ? 5 : 12 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 1.75,
                  borderRadius: 2.5,
                  boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
                  height: '100%',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                  <WarningAmberRoundedIcon color="warning" />
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {adminRole === 'super_admin' ? 'Pending Delete Requests' : 'Your Pending Delete Requests'}
                    </Typography>
                    {adminRole === 'system_admin' ? (
                      <Typography variant="caption" color="text.secondary">
                        Requests you sent that are still waiting for super-admin review.
                      </Typography>
                    ) : null}
                  </Box>
                </Stack>
                <Stack spacing={1}>
                  {queueCards.map((queue) => (
                    <Paper
                      key={queue.label}
                      component={Link}
                      href={queue.href}
                      elevation={0}
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        bgcolor: 'grey.50',
                        color: 'text.primary',
                        textDecoration: 'none',
                        '&:hover': {
                          bgcolor: 'rgba(243, 165, 49, 0.08)',
                          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.07)',
                        },
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
                        <Typography variant="body2" fontWeight={650}>
                          {queue.label}
                        </Typography>
                        <Chip
                          label={queue.value}
                          color={queue.value > 0 ? 'warning' : 'default'}
                          size="small"
                          sx={{ minWidth: 40, borderRadius: 2 }}
                        />
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            </Grid>

            {adminRole === 'super_admin' ? (
              <Grid size={{ xs: 12, lg: 7 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.75,
                    borderRadius: 2.5,
                    boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
                    height: '100%',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <HistoryRoundedIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Recent Admin Activity
                    </Typography>
                  </Stack>

                  {recentActivity.length > 0 ? (
                    <Stack spacing={1}>
                      {recentActivity.map((activity) => (
                        <Paper
                          key={activity.id}
                          component={Link}
                          href={`/activity-logs/${activity.id}`}
                          elevation={0}
                          sx={{
                            p: 1.25,
                            borderRadius: 2,
                            bgcolor: 'grey.50',
                            color: 'text.primary',
                            textDecoration: 'none',
                            '&:hover': {
                              bgcolor: 'rgba(0, 84, 255, 0.06)',
                              boxShadow: '0 10px 24px rgba(15, 23, 42, 0.07)',
                            },
                          }}
                        >
                          <Typography variant="body2" fontWeight={650}>
                            {activity.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {activity.actor.name} • {formatDateTime(activity.createdAt)}
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No activity logs yet.
                    </Typography>
                  )}
                </Paper>
              </Grid>
            ) : null}
          </Grid>

          {/*
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, lg: 5 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.25,
                    borderRadius: 2.5,
                    boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
                    height: '100%',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <WarningAmberRoundedIcon color="warning" />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Pending Delete Requests
                    </Typography>
                  </Stack>
                  <Stack spacing={1}>
                    {queueCards.map((queue) => (
                      <Paper
                        key={queue.label}
                        component={Link}
                        href={queue.href}
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'grey.200',
                          color: 'text.primary',
                          textDecoration: 'none',
                          '&:hover': {
                            borderColor: 'warning.main',
                          },
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
                          <Typography variant="body2" fontWeight={650}>
                            {queue.label}
                          </Typography>
                          <Chip
                            label={queue.value}
                            color={queue.value > 0 ? 'warning' : 'default'}
                            size="small"
                            sx={{ minWidth: 40, borderRadius: 2 }}
                          />
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, lg: 7 }}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2.25,
                    borderRadius: 2.5,
                    border: '1px solid',
                    borderColor: 'grey.200',
                    height: '100%',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <HistoryRoundedIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Recent Admin Activity
                    </Typography>
                  </Stack>

                  {recentActivity.length > 0 ? (
                    <Stack spacing={1}>
                      {recentActivity.map((activity) => (
                        <Paper
                          key={activity.id}
                          component={Link}
                          href={`/activity-logs/${activity.id}`}
                          elevation={0}
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'grey.200',
                            color: 'text.primary',
                            textDecoration: 'none',
                            '&:hover': {
                              borderColor: 'primary.main',
                            },
                          }}
                        >
                          <Typography variant="body2" fontWeight={650}>
                            {activity.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {activity.actor.name} • {formatDateTime(activity.createdAt)}
                          </Typography>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No activity logs yet.
                    </Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          */}
        </>
      )}
    </Stack>
  );
}
