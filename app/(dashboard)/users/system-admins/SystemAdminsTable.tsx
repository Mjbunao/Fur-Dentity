'use client';

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
  DeleteOutlineIcon,
  SearchIcon,
  ToggleOffRoundedIcon,
  ToggleOnRoundedIcon,
} from '@/components/icons';

type SystemAdminRow = {
  uid: string;
  name: string;
  email: string;
  status: string;
  mustChangePassword: boolean;
  createdAt: string;
};

type SortKey = 'name' | 'email' | 'status' | 'mustChangePassword';
type SortOrder = 'asc' | 'desc';

const headCells: Array<{ id: SortKey; label: string }> = [
  { id: 'name', label: 'Name' },
  { id: 'email', label: 'Email Address' },
  { id: 'status', label: 'Status' },
  { id: 'mustChangePassword', label: 'Password Reset' },
];

const tableContainerSx = {
  borderRadius: 2.5,
  border: '1px solid',
  borderColor: 'grey.200',
};

export default function SystemAdminsTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const [rows, setRows] = useState<SystemAdminRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SystemAdminRow | null>(null);

  const loadSystemAdmins = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');
      setMessage('');

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/admins/system-admins/list', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as
        | { admins?: SystemAdminRow[]; error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to load system admin accounts.');
        return;
      }

      setRows(data?.admins ?? []);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load system admin accounts.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadSystemAdmins();
  }, [refreshKey]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const searched = !normalizedSearch
      ? rows
      : rows.filter((row) =>
          [
            row.name,
            row.email,
            row.status,
            row.mustChangePassword ? 'required' : 'completed',
            row.mustChangePassword ? 'must change password' : 'password updated',
          ].some((value) => value.toLowerCase().includes(normalizedSearch))
        );

    return [...searched].sort((left, right) => {
      if (sortKey === 'mustChangePassword') {
        const comparison = Number(left.mustChangePassword) - Number(right.mustChangePassword);
        return sortOrder === 'asc' ? comparison : -comparison;
      }

      const comparison = left[sortKey].localeCompare(right[sortKey]);
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [rows, search, sortKey, sortOrder]);

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
    setSortOrder('asc');
  };

  const handleToggleStatus = async (row: SystemAdminRow) => {
    try {
      setError('');
      setMessage('');

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const nextStatus = row.status === 'active' ? 'inactive' : 'active';
      const idToken = await currentUser.getIdToken();
      const response = await fetch(`/api/admins/system-admins/${row.uid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; status?: string }
        | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to update the system admin status.');
        return;
      }

      setRows((currentRows) =>
        currentRows.map((currentRow) =>
          currentRow.uid === row.uid
            ? { ...currentRow, status: data?.status || nextStatus }
            : currentRow
        )
      );
      setMessage(`${row.name} is now ${data?.status || nextStatus}.`);
    } catch (updateError) {
      console.error(updateError);
      setError('Failed to update the system admin status.');
    }
  };

  const handleDelete = async (row: SystemAdminRow) => {
    setDeleteTarget(row);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      setError('');
      setMessage('');

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch(`/api/admins/system-admins/${deleteTarget.uid}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; note?: string }
        | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to remove the system admin account.');
        return;
      }

      setRows((currentRows) =>
        currentRows.filter((currentRow) => currentRow.uid !== deleteTarget.uid)
      );
      setMessage(
        data?.note
          ? `${deleteTarget.name} was removed. ${data.note}`
          : `${deleteTarget.name} was removed successfully.`
      );
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to remove the system admin account.');
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'grey.200',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 2.25 }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700} color="text.primary">
            System Admin Directory
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Review created system admin accounts, their current access status, and password reset progress.
          </Typography>
        </Box>

        <TextField
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          placeholder="Search name, email, status, or password reset"
          size="small"
          sx={{ minWidth: { xs: '100%', md: 300 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {message ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      ) : null}

      <TableContainer sx={{ ...tableContainerSx, maxHeight: 520 }}>
        <Table stickyHeader size="small" aria-label="system admins table">
          <TableHead>
            <TableRow>
              {headCells.map((cell) => (
                <TableCell
                  key={cell.id}
                  sortDirection={sortKey === cell.id ? sortOrder : false}
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
                Actions
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
                      Loading system admins...
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
                      No system admins found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Try adjusting your search or create the first system admin account from the button below.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : null}

            {!loading
              ? paginatedRows.map((row) => (
                  <TableRow hover key={row.uid}>
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography variant="body2" fontWeight={700} lineHeight={1.25}>
                        {row.name}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>{row.email}</TableCell>
                    <TableCell sx={{ py: 1.25, textTransform: 'capitalize' }}>{row.status}</TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      {row.mustChangePassword ? 'Required' : 'Completed'}
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Stack direction="row" spacing={0.75}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={
                            row.status === 'active' ? (
                              <ToggleOffRoundedIcon fontSize="small" />
                            ) : (
                              <ToggleOnRoundedIcon fontSize="small" />
                            )
                          }
                          sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
                          onClick={() => void handleToggleStatus(row)}
                        >
                          {row.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={<DeleteOutlineIcon fontSize="small" />}
                          sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
                          onClick={() => void handleDelete(row)}
                        >
                          Delete
                        </Button>
                      </Stack>
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

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Remove system admin?"
        description={
          deleteTarget
            ? `Remove ${deleteTarget.name}? This revokes their admin access.`
            : ''
        }
        confirmLabel="Remove admin"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </Paper>
  );
}
