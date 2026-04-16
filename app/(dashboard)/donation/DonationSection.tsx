'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import { auth } from '@/lib/firebase';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import {
  AddRoundedIcon,
  SearchIcon,
} from '@/components/icons';
import DonationDeleteRequestsTable from './DonationDeleteRequestsTable';
import DonationFormDialog, { type DonationFormPayload } from './DonationFormDialog';
import type {
  DonationDeleteRequestRow,
  DonationRow,
  DonationSectionProps,
  DonationUserOption,
} from './types';

type SortKey = 'name' | 'amount' | 'date' | 'platform';
type SortOrder = 'asc' | 'desc';

const headCells: Array<{ id: SortKey; label: string; numeric?: boolean }> = [
  { id: 'name', label: 'Name' },
  { id: 'amount', label: 'Amount', numeric: true },
  { id: 'date', label: 'Date' },
  { id: 'platform', label: 'Platform' },
];

export default function DonationSection({
  adminRole,
  adminUid: _adminUid,
  adminName: _adminName,
  adminEmail: _adminEmail,
}: DonationSectionProps) {
  const router = useRouter();
  const [rows, setRows] = useState<DonationRow[]>([]);
  const [users, setUsers] = useState<DonationUserOption[]>([]);
  const [requests, setRequests] = useState<DonationDeleteRequestRow[]>([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [requestLoading, setRequestLoading] = useState(false);
  const [error, setError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [message, setMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedDonation, setSelectedDonation] = useState<DonationRow | null>(null);
  const [reviewRequestTarget, setReviewRequestTarget] = useState<DonationDeleteRequestRow | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [saving, setSaving] = useState(false);

  void _adminUid;
  void _adminName;
  void _adminEmail;

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

  const loadDonationData = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');

      const headers = await getAuthHeaders();
      const [donationsResponse, metaResponse] = await Promise.all([
        fetch('/api/donations', { headers }),
        fetch('/api/donations/meta', { headers }),
      ]);

      const donationData = (await donationsResponse.json().catch(() => null)) as
        | { donations?: DonationRow[]; error?: string }
        | null;
      const metaData = (await metaResponse.json().catch(() => null)) as
        | { users?: DonationUserOption[]; error?: string }
        | null;

      if (!donationsResponse.ok) {
        setError(donationData?.error || 'Failed to load donations.');
        return;
      }

      if (!metaResponse.ok) {
        setError(metaData?.error || 'Failed to load donation form data.');
        return;
      }

      setRows(donationData?.donations ?? []);
      setUsers(metaData?.users ?? []);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load donations.');
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
      const response = await fetch('/api/donations/delete-requests', { headers });
      const data = (await response.json().catch(() => null)) as
        | { requests?: DonationDeleteRequestRow[]; error?: string }
        | null;

      if (!response.ok) {
        setRequestError(data?.error || 'Failed to load donation delete requests.');
        return;
      }

      setRequests(data?.requests ?? []);
    } catch (loadError) {
      console.error(loadError);
      setRequestError('Failed to load donation delete requests.');
    } finally {
      setRequestLoading(false);
    }
  });

  useEffect(() => {
    void loadDonationData();
    void loadDeleteRequests();
  }, [adminRole]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const searched = !normalizedSearch
      ? rows
      : rows.filter((row) =>
          [row.name, row.email, row.platform, row.reference].some((value) =>
            value.toLowerCase().includes(normalizedSearch)
          )
        );

    const dateFiltered = searched.filter((row) => {
      if (!dateFilter) {
        return true;
      }

      if (!row.date) {
        return false;
      }

      const rowDate = new Date(row.date);
      if (Number.isNaN(rowDate.getTime())) {
        return false;
      }

      const normalizedDate = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, '0')}`;
      return normalizedDate === dateFilter;
    });

    return [...dateFiltered].sort((left, right) => {
      if (sortKey === 'amount') {
        const comparison = left.amount - right.amount;
        return sortOrder === 'asc' ? comparison : -comparison;
      }

      const comparison =
        sortKey === 'date'
          ? new Date(left.date).getTime() - new Date(right.date).getTime()
          : String(left[sortKey]).localeCompare(String(right[sortKey]));
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [rows, search, dateFilter, sortKey, sortOrder]);

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
    setSortOrder(property === 'date' ? 'desc' : 'asc');
  };

  const openCreateDialog = () => {
    setFormMode('create');
    setSelectedDonation(null);
    setFormOpen(true);
  };

  const handleSubmitDonation = async (payload: DonationFormPayload) => {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch(
        formMode === 'create' ? '/api/donations' : `/api/donations/${selectedDonation?.id}`,
        {
          method: formMode === 'create' ? 'POST' : 'PATCH',
          headers,
          body: JSON.stringify(payload),
        }
      );

      const data = (await response.json().catch(() => null)) as
        | { donation?: DonationRow; error?: string }
        | null;

      if (!response.ok || !data?.donation) {
        setError(data?.error || 'Failed to save the donation.');
        return;
      }

      if (formMode === 'create') {
        setRows((current) => [data.donation as DonationRow, ...current]);
        setMessage('Donation created successfully.');
      } else {
        setRows((current) =>
          current.map((row) => (row.id === data.donation?.id ? (data.donation as DonationRow) : row))
        );
        setMessage('Donation updated successfully.');
      }

      setFormOpen(false);
      setSelectedDonation(null);
    } catch (submitError) {
      console.error(submitError);
      setError('Failed to save the donation.');
    } finally {
      setSaving(false);
    }
  };

  const handleReviewRequest = async () => {
    if (!reviewRequestTarget) {
      return;
    }

    try {
      setSaving(true);
      setRequestError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/donations/delete-requests/${reviewRequestTarget.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: reviewAction }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setRequestError(data?.error || 'Failed to update the delete request.');
        return;
      }

      if (reviewAction === 'approve') {
        setRows((current) => current.filter((row) => row.id !== reviewRequestTarget.donationId));
        setMessage(`Donation deleted after approving the request for ${reviewRequestTarget.donationName}.`);
      } else {
        setRows((current) =>
          current.map((row) =>
            row.id === reviewRequestTarget.donationId ? { ...row, requestStatus: 'rejected' } : row
          )
        );
        setMessage(`Delete request rejected for ${reviewRequestTarget.donationName}.`);
      }

      setRequests((current) => current.filter((request) => request.id !== reviewRequestTarget.id));
      setReviewRequestTarget(null);
    } catch (reviewError) {
      console.error(reviewError);
      setRequestError('Failed to update the delete request.');
    } finally {
      setSaving(false);
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
              Donation Directory
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Track donor payments, update donation details, and review delete requests.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <TextField
              label="Donation Date"
              type="month"
              value={dateFilter}
              onChange={(event) => {
                setDateFilter(event.target.value);
                setPage(0);
              }}
              size="small"
              sx={{ minWidth: { xs: '100%', sm: 170 } }}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <TextField
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="Search donor, email, platform, or reference"
              size="small"
              sx={{ minWidth: { xs: '100%', sm: 300 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <Button variant="contained" startIcon={<AddRoundedIcon sx={{ fontSize: 18 }} />} onClick={openCreateDialog}>
              Create donation
            </Button>
          </Stack>
        </Stack>

        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}

        <TableContainer sx={{ borderRadius: 2.5, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)', maxHeight: 520 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {headCells.map((cell) => (
                  <TableCell
                    key={cell.id}
                    sortDirection={sortKey === cell.id ? sortOrder : false}
                    align={cell.numeric ? 'right' : 'left'}
                    sx={{ bgcolor: 'background.paper', fontWeight: 700, py: 1.25 }}
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
                <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700, py: 1.25 }}>
                  Request
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" py={5}>
                      <CircularProgress size={20} />
                      <Typography variant="body2" color="text.secondary">
                        Loading donations...
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
                        No donations found
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Try adjusting the filters or create the first donation entry.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading
                ? paginatedRows.map((row) => (
                    <TableRow hover key={row.id} onClick={() => router.push(`/donation/${row.id}`)} sx={{ cursor: 'pointer' }}>
                      <TableCell sx={{ py: 1.25 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {row.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.email}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }} align="right">
                        PHP {row.amount.toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ py: 1.25 }}>{row.date}</TableCell>
                      <TableCell sx={{ py: 1.25 }}>{row.platform}</TableCell>
                      <TableCell sx={{ py: 1.25, textTransform: 'capitalize' }}>
                        {row.requestStatus ?? 'None'}
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

      {adminRole === 'super_admin' ? (
        <DonationDeleteRequestsTable
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

      <DonationFormDialog
        key={`${formMode}-${selectedDonation?.id ?? 'new'}-${formOpen ? 'open' : 'closed'}`}
        open={formOpen}
        mode={formMode}
        donation={selectedDonation}
        users={users}
        loading={saving}
        onClose={() => {
          setFormOpen(false);
          setSelectedDonation(null);
        }}
        onSubmit={handleSubmitDonation}
      />

      <ConfirmDeleteDialog
        open={!!reviewRequestTarget}
        title={reviewAction === 'approve' ? 'Approve delete request?' : 'Reject delete request?'}
        description={
          reviewRequestTarget
            ? reviewAction === 'approve'
              ? `Approve the request and delete ${reviewRequestTarget.donationName}?`
              : `Reject the delete request for ${reviewRequestTarget.donationName}?`
            : ''
        }
        confirmLabel={reviewAction === 'approve' ? 'Approve delete' : 'Reject request'}
        loading={saving}
        onClose={() => setReviewRequestTarget(null)}
        onConfirm={() => void handleReviewRequest()}
      />
    </Stack>
  );
}
