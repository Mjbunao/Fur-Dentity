'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { auth } from '@/lib/firebase';
import type { AdminRole } from '@/lib/auth/types';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import {
  SearchIcon,
  VisibilityRoundedIcon,
} from '@/components/icons';
import ReportDeleteRequestsTable from './ReportDeleteRequestsTable';
import type {
  RegistrationType,
  ReportDeleteRequestRow,
  ReportKind,
  ReportMatchRow,
  ReportRow,
  ReportStatus,
} from './types';

type SortKey = 'reporterName' | 'reportType' | 'petName' | 'status' | 'submittedAt';
type SortOrder = 'asc' | 'desc';
type ReportTab = 'processing' | 'finished';

const headCells: Array<{ id: SortKey; label: string }> = [
  { id: 'reporterName', label: 'Reporter' },
  { id: 'reportType', label: 'Type' },
  { id: 'petName', label: 'Pet Name' },
  { id: 'status', label: 'Status' },
  { id: 'submittedAt', label: 'Submitted' },
];

const ellipsisSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

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

export default function ReportsSection({ adminRole }: { adminRole: AdminRole }) {
  const router = useRouter();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [matches, setMatches] = useState<ReportMatchRow[]>([]);
  const [requests, setRequests] = useState<ReportDeleteRequestRow[]>([]);
  const [totalMonthlyReports, setTotalMonthlyReports] = useState(0);
  const [activeTab, setActiveTab] = useState<ReportTab>('processing');
  const [typeFilter, setTypeFilter] = useState<ReportKind | 'all'>('all');
  const [registrationFilter, setRegistrationFilter] = useState<RegistrationType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('submittedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [requestLoading, setRequestLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [message, setMessage] = useState('');
  const [reviewRequestTarget, setReviewRequestTarget] = useState<ReportDeleteRequestRow | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');

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

  const loadReports = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');

      const headers = await getAuthHeaders();
      const response = await fetch('/api/reports', { headers });
      const data = (await response.json().catch(() => null)) as
        | { reports?: ReportRow[]; matches?: ReportMatchRow[]; totalMonthlyReports?: number; error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to load reports.');
        return;
      }

      setRows(data?.reports ?? []);
      setMatches(data?.matches ?? []);
      setTotalMonthlyReports(data?.totalMonthlyReports ?? 0);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load reports.');
    } finally {
      setLoading(false);
    }
  });

  const loadDeleteRequests = useEffectEvent(async () => {
    if (adminRole !== 'super_admin') {
      return;
    }

    try {
      setRequestLoading(true);
      setRequestError('');

      const headers = await getAuthHeaders();
      const response = await fetch('/api/reports/delete-requests', { headers });
      const data = (await response.json().catch(() => null)) as
        | { requests?: ReportDeleteRequestRow[]; error?: string }
        | null;

      if (!response.ok) {
        setRequestError(data?.error || 'Failed to load report delete requests.');
        return;
      }

      setRequests(data?.requests ?? []);
    } catch (loadError) {
      console.error(loadError);
      setRequestError('Failed to load report delete requests.');
    } finally {
      setRequestLoading(false);
    }
  });

  useEffect(() => {
    void loadReports();
    void loadDeleteRequests();
  }, [adminRole]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const tabbedRows = rows.filter((row) =>
      activeTab === 'finished' ? row.status === 'Finished' : row.status !== 'Finished'
    );

    const filtered = tabbedRows.filter((row) => {
      const typeMatches = typeFilter === 'all' || row.reportType === typeFilter;
      const registrationMatches = registrationFilter === 'all' || row.registrationType === registrationFilter;
      const searchMatches =
        !normalizedSearch ||
        [row.reporterName, row.reporterEmail, row.petName, row.status, row.reportType, row.subDir].some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        );

      return typeMatches && registrationMatches && searchMatches;
    });

    return [...filtered].sort((left, right) => {
      const comparison =
        sortKey === 'submittedAt'
          ? new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime()
          : String(left[sortKey]).localeCompare(String(right[sortKey]));
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [rows, activeTab, typeFilter, registrationFilter, search, sortKey, sortOrder]);

  const paginatedRows = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, page, rowsPerPage]);

  const handleRequestSort = (property: SortKey) => {
    if (sortKey === property) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(property);
    setSortOrder(property === 'submittedAt' ? 'desc' : 'asc');
  };

  const handleReviewRequest = async () => {
    if (!reviewRequestTarget) {
      return;
    }

    try {
      setDeleting(true);
      setRequestError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/reports/delete-requests/${reviewRequestTarget.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: reviewAction }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setRequestError(data?.error || 'Failed to update report delete request.');
        return;
      }

      if (reviewAction === 'approve') {
        setRows((current) => current.filter((row) => row.id !== reviewRequestTarget.reportKey));
        setMatches((current) =>
          current.filter(
            (match) =>
              match.missing.id !== reviewRequestTarget.reportKey &&
              match.found.id !== reviewRequestTarget.reportKey
          )
        );
        setMessage(`Report deleted after approving the request for ${reviewRequestTarget.petName}.`);
      } else {
        setRows((current) =>
          current.map((row) =>
            row.id === reviewRequestTarget.reportKey ? { ...row, requestStatus: 'rejected' as const } : row
          )
        );
        setMessage(`Delete request rejected for ${reviewRequestTarget.petName}.`);
      }

      setRequests((current) => current.filter((row) => row.id !== reviewRequestTarget.id));
      setReviewRequestTarget(null);
    } catch (reviewError) {
      console.error(reviewError);
      setRequestError('Failed to update report delete request.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, md: 2 },
          borderRadius: 2.5,
          boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', lg: 'center' }}
          sx={{ mb: 1.5 }}
        >
          <Box>
            <Typography variant="h6" fontWeight={700}>
              Report Directory
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Review missing and found pet reports, update status, and inspect possible matches.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Reports this month: {totalMonthlyReports}
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 145 } }}>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value as ReportKind | 'all');
                  setPage(0);
                }}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="missing">Missing Only</MenuItem>
                <MenuItem value="found">Found Only</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 175 } }}>
              <InputLabel>Pets</InputLabel>
              <Select
                label="Pets"
                value={registrationFilter}
                onChange={(event) => {
                  setRegistrationFilter(event.target.value as RegistrationType | 'all');
                  setPage(0);
                }}
              >
                <MenuItem value="all">All Pets</MenuItem>
                <MenuItem value="registered">Registered Only</MenuItem>
                <MenuItem value="unregistered">Unregistered Only</MenuItem>
              </Select>
            </FormControl>

            <TextField
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Search reporter, pet, or status"
              size="small"
              sx={{ minWidth: { xs: '100%', sm: 285 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </Stack>

        <Tabs
          value={activeTab}
          onChange={(_, nextValue: ReportTab) => {
            setActiveTab(nextValue);
            setPage(0);
          }}
          sx={{ mb: 1.25 }}
        >
          <Tab value="processing" label={`Processing (${rows.filter((row) => row.status !== 'Finished').length})`} />
          <Tab value="finished" label={`Finished (${rows.filter((row) => row.status === 'Finished').length})`} />
        </Tabs>

        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}

        <TableContainer sx={{ borderRadius: 2.5, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)', maxHeight: 520 }}>
          <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                {headCells.map((cell) => (
                  <TableCell
                    key={cell.id}
                    sortDirection={sortKey === cell.id ? sortOrder : false}
                    sx={{
                      bgcolor: 'background.paper',
                      fontWeight: 700,
                      py: 1.25,
                      width:
                        cell.id === 'reporterName'
                          ? '22%'
                          : cell.id === 'reportType'
                            ? '11%'
                            : cell.id === 'petName'
                              ? '10%'
                              : cell.id === 'status'
                                ? '11%'
                                : '19%',
                    }}
                  >
                    <TableSortLabel
                      active={sortKey === cell.id}
                      direction={sortKey === cell.id ? sortOrder : 'asc'}
                      onClick={() => handleRequestSort(cell.id)}
                    >
                      {cell.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" py={5}>
                      <CircularProgress size={20} />
                      <Typography variant="body2" color="text.secondary">
                        Loading reports...
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading && paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Box py={5} textAlign="center">
                      <Typography variant="subtitle1" fontWeight={700}>
                        No reports found
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Try adjusting your search or filters.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading
                ? paginatedRows.map((row) => (
                    <TableRow
                      hover
                      key={row.id}
                      sx={{ bgcolor: row.opened ? 'inherit' : 'grey.50', cursor: 'pointer' }}
                      onClick={() => router.push(`/reports/${row.id}`)}
                    >
                      <TableCell sx={{ py: 1.25 }}>
                        <Typography variant="body2" fontWeight={700} sx={ellipsisSx}>
                          {row.reporterName}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', ...ellipsisSx }}
                        >
                          {row.reporterEmail}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Typography variant="body2" textTransform="capitalize" sx={ellipsisSx}>
                          {row.reportType}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          textTransform="capitalize"
                          sx={{ display: 'block', ...ellipsisSx }}
                        >
                          {row.registrationType}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Typography variant="body2" sx={ellipsisSx}>
                          {row.petName}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Chip size="small" label={row.status} color={statusColor(row.status)} variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>
                        <Typography variant="body2" sx={ellipsisSx}>
                          {row.submittedAtLabel}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                : null}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredRows.length}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25]}
          sx={{
            '.MuiTablePagination-toolbar': {
              minHeight: 44,
              px: 0.5,
            },
            '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
              fontSize: '0.8125rem',
            },
          }}
        />
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, md: 2 },
          borderRadius: 2.5,
          boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="h6" fontWeight={700}>
            Match Reports
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Review reports that may refer to the same registered pet.
          </Typography>
        </Box>

        <Stack spacing={1.25}>
          {matches.length === 0 ? (
            <Box py={4} textAlign="center">
              <Typography variant="subtitle1" fontWeight={700}>
                No possible matches
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Matched missing/found reports will appear here.
              </Typography>
            </Box>
          ) : (
            matches.map((match) => (
              <Paper
                key={match.id}
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'grey.200',
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" fontWeight={700}>
                      Possible match: {match.petName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Missing: {match.missing.reporterName} ({match.missing.status}) | Found: {match.found.reporterName} ({match.found.status})
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<VisibilityRoundedIcon fontSize="small" />}
                      sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
                      onClick={() => router.push(`/reports/${match.missing.id}`)}
                    >
                      Missing
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<VisibilityRoundedIcon fontSize="small" />}
                      sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
                      onClick={() => router.push(`/reports/${match.found.id}`)}
                    >
                      Found
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      </Paper>

      {adminRole === 'super_admin' ? (
        <ReportDeleteRequestsTable
          rows={requests}
          loading={requestLoading}
          error={requestError}
          onApprove={(request) => {
            setReviewRequestTarget(request);
            setReviewAction('approve');
          }}
          onReject={(request) => {
            setReviewRequestTarget(request);
            setReviewAction('reject');
          }}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={!!reviewRequestTarget}
        title={reviewAction === 'approve' ? 'Approve delete request?' : 'Reject delete request?'}
        description={
          reviewRequestTarget
            ? reviewAction === 'approve'
              ? `Approve the request and delete the report for ${reviewRequestTarget.petName}?`
              : `Reject the delete request for ${reviewRequestTarget.petName}?`
            : ''
        }
        confirmLabel={reviewAction === 'approve' ? 'Approve delete' : 'Reject request'}
        loading={deleting}
        onClose={() => setReviewRequestTarget(null)}
        onConfirm={() => void handleReviewRequest()}
      />
    </Stack>
  );
}
