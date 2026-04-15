'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { auth } from '@/lib/firebase';
import type { AdminRole } from '@/lib/auth/types';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import {
  CloseRoundedIcon,
  DeleteOutlineIcon,
  RequestPageRoundedIcon,
  SaveRoundedIcon,
} from '@/components/icons';
import { DetailCard, DetailInfoRow, DetailPageHeader } from '@/components/DetailPageScaffold';
import type { ReportRow, ReportStatus } from '../types';

const statuses: ReportStatus[] = ['Pending', 'Received', 'Processing', 'Rejected', 'Finished'];

const statusColor = (status: ReportStatus) => {
  if (status === 'Finished') {
    return 'success';
  }

  if (status === 'Rejected') {
    return 'error';
  }

  if (status === 'Processing') {
    return 'primary';
  }

  if (status === 'Received') {
    return 'info';
  }

  return 'warning';
};

const detailRows = (report: ReportRow) => [
  ['Reported By', report.reporterName],
  ['Reporter Email', report.reporterEmail],
  ['Reporter Contact', report.reporterContact],
  ['Pet Name', report.petName],
  ['Birthdate', report.petDetails.birthdate],
  ['Age', report.petDetails.age],
  ['Breed', report.petDetails.breed],
  ['Last Seen Date', report.dateLastSeen],
  ['Last Seen Location', report.lastSeen],
  ['State', report.state],
  ['Description', report.details],
  ['Submitted At', report.submittedAtLabel],
  ['Finished At', report.finishedAt ? report.finishedAtLabel : 'Not finished'],
];

const toTitleCase = (value: string) =>
  value
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');

export default function ReportDetailsPage({
  reportKey,
  adminRole,
}: {
  reportKey: string;
  adminRole: AdminRole;
}) {
  const router = useRouter();
  const [report, setReport] = useState<ReportRow | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus>('Pending');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [requestDeleteOpen, setRequestDeleteOpen] = useState(false);
  const [cancelRequestOpen, setCancelRequestOpen] = useState(false);

  const canDelete = adminRole === 'super_admin';

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

  const loadReport = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/reports/${reportKey}`, { headers });
      const data = (await response.json().catch(() => null)) as { report?: ReportRow; error?: string } | null;

      if (!response.ok || !data?.report) {
        setError(data?.error || 'Failed to load report details.');
        return;
      }

      setReport(data.report);
      setSelectedStatus(data.report.status);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load report details.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadReport();
  }, [reportKey]);

  const updateStatus = async () => {
    if (!report) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/reports/${reportKey}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: selectedStatus }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to update report status.');
        return;
      }

      setReport({ ...report, status: selectedStatus });
      setMessage('Report status updated successfully.');
    } catch (saveError) {
      console.error(saveError);
      setError('Failed to update report status.');
    } finally {
      setSaving(false);
    }
  };

  const deleteReport = async () => {
    if (!report) {
      return;
    }

    try {
      setDeleting(true);
      setError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/reports/${reportKey}`, {
        method: 'DELETE',
        headers,
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to delete report.');
        return;
      }

      router.push('/reports');
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to delete report.');
    } finally {
      setDeleting(false);
    }
  };

  const submitDeleteRequest = async () => {
    if (!report) {
      return;
    }

    try {
      setDeleting(true);
      setError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch('/api/reports/delete-requests', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reportKey: report.id,
          reportId: report.reportId,
          mainDir: report.mainDir,
          subDir: report.subDir,
          reportType: report.reportType,
          petName: report.petName,
          reportStatus: report.status,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to submit report delete request.');
        return;
      }

      setReport({ ...report, requestStatus: 'pending' });
      setMessage(`Delete request submitted for ${report.petName}.`);
      setRequestDeleteOpen(false);
    } catch (requestError) {
      console.error(requestError);
      setError('Failed to submit report delete request.');
    } finally {
      setDeleting(false);
    }
  };

  const cancelDeleteRequest = async () => {
    if (!report) {
      return;
    }

    try {
      setDeleting(true);
      setError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch('/api/reports/delete-requests', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ reportKey: report.id }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to cancel report delete request.');
        return;
      }

      setReport({ ...report, requestStatus: null });
      setMessage(`Delete request canceled for ${report.petName}.`);
      setCancelRequestOpen(false);
    } catch (cancelError) {
      console.error(cancelError);
      setError('Failed to cancel report delete request.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <DetailPageHeader
        title="Report Information"
        description="Review report details, reporter information, pet data, and update the report status."
        backLabel="Back to reports"
        onBack={() => router.push('/reports')}
        action={
          canDelete ? (
            <Button
              color="error"
              variant="outlined"
              size="small"
              startIcon={<DeleteOutlineIcon fontSize="small" />}
              onClick={() => setDeleteOpen(true)}
              disabled={deleting || loading}
              sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
            >
              Delete
            </Button>
          ) : report ? (
            <Button
              color="error"
              variant="outlined"
              size="small"
              startIcon={
                report.requestStatus === 'pending' ? (
                  <CloseRoundedIcon fontSize="small" />
                ) : (
                  <RequestPageRoundedIcon fontSize="small" />
                )
              }
              onClick={() =>
                report.requestStatus === 'pending'
                  ? setCancelRequestOpen(true)
                  : setRequestDeleteOpen(true)
              }
              disabled={deleting || loading}
              sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
            >
              {report.requestStatus === 'pending' ? 'Cancel Request' : 'Request Delete'}
            </Button>
          ) : null
        }
      />

      {loading ? (
        <DetailCard>
          <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Loading report details...
            </Typography>
          </Stack>
        </DetailCard>
      ) : null}

      {!loading && error ? <Alert severity="error">{error}</Alert> : null}
      {!loading && message ? <Alert severity="success">{message}</Alert> : null}

      {!loading && report ? (
        <DetailCard>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5}>
            <Stack spacing={2} sx={{ width: { xs: '100%', lg: 250 }, alignItems: { xs: 'center', lg: 'stretch' } }}>
              <Box
                component="img"
                src={report.petImage || '/Profile.webp'}
                alt={report.petName}
                sx={{
                  width: { xs: 112, lg: '100%' },
                  height: { xs: 112, lg: 210 },
                  borderRadius: 2.5,
                  objectFit: 'cover',
                  border: '1px solid',
                  borderColor: 'grey.200',
                }}
              />

              {report.reportImage ? (
                <Box
                  component="img"
                  src={report.reportImage}
                  alt={`${report.petName} report`}
                  sx={{
                    width: '100%',
                    maxWidth: 250,
                    height: 150,
                    borderRadius: 2.5,
                    objectFit: 'cover',
                    border: '1px solid',
                    borderColor: 'grey.200',
                  }}
                />
              ) : (
                <Typography variant="caption" color="text.secondary" textAlign="center">
                  No report image available.
                </Typography>
              )}

              <Stack direction="row" spacing={0.75} flexWrap="wrap">
                {report.petDetails.colors.length > 0 ? (
                  report.petDetails.colors.map((color) => (
                    <Chip
                      key={`${report.id}-${color}`}
                      size="small"
                      label={color}
                      sx={{
                        bgcolor: color,
                        color: '#111827',
                        border: '1px solid rgba(15, 23, 42, 0.14)',
                      }}
                    />
                  ))
                ) : (
                  <Chip size="small" label="No colors listed" />
                )}
              </Stack>
            </Stack>

            <Stack spacing={2} sx={{ flex: 1 }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    {toTitleCase(report.reportType)} Pet / {toTitleCase(report.registrationType)}
                  </Typography>
                  <Stack direction="row" spacing={0.75} sx={{ mt: 1 }}>
                    <Chip size="small" label={report.status} color={statusColor(report.status)} variant="outlined" />
                    <Chip size="small" label={report.registrationType} variant="outlined" />
                  </Stack>
                </Box>

                <Stack direction="row" spacing={1}>
                  <FormControl size="small" sx={{ minWidth: 145 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                      label="Status"
                      value={selectedStatus}
                      onChange={(event) => setSelectedStatus(event.target.value as ReportStatus)}
                    >
                      {statuses.map((status) => (
                        <MenuItem key={status} value={status}>
                          {status}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<SaveRoundedIcon fontSize="small" />}
                    onClick={() => void updateStatus()}
                    disabled={saving || selectedStatus === report.status}
                  >
                    Save
                  </Button>
                </Stack>
              </Stack>

              <Stack spacing={0.35}>
                {detailRows(report).map(([label, value]) => (
                  <DetailInfoRow key={label} label={label} value={value} />
                ))}
              </Stack>
            </Stack>
          </Stack>
        </DetailCard>
      ) : null}

      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Delete report?"
        description={
          report
            ? `Delete the ${report.reportType} report for ${report.petName}? This removes the ticket record from the database.`
            : ''
        }
        confirmLabel="Delete report"
        loading={deleting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void deleteReport()}
      />

      <ConfirmDeleteDialog
        open={requestDeleteOpen}
        title="Request report deletion?"
        description={
          report
            ? `Send a delete request for the ${report.reportType} report for ${report.petName}? A super admin will review it before removal.`
            : ''
        }
        confirmLabel="Send request"
        loading={deleting}
        onClose={() => setRequestDeleteOpen(false)}
        onConfirm={() => void submitDeleteRequest()}
      />

      <ConfirmDeleteDialog
        open={cancelRequestOpen}
        title="Cancel delete request?"
        description={report ? `Cancel the pending delete request for the report for ${report.petName}?` : ''}
        confirmLabel="Cancel request"
        confirmColor="warning"
        confirmIcon="close"
        loading={deleting}
        onClose={() => setCancelRequestOpen(false)}
        onConfirm={() => void cancelDeleteRequest()}
      />
    </Stack>
  );
}
