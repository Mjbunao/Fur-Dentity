'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import {
  Alert,
  Box,
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
import type { AdminRole } from '@/lib/auth/types';
import { auth } from '@/lib/firebase';
import { SearchIcon } from '@/components/icons';

type UserRow = {
  id: string;
  name: string;
  email: string;
  contact: string;
  address: string;
  profilePic: string;
  petsCount: number;
};

type SortKey = 'name' | 'email' | 'contact' | 'petsCount';
type SortOrder = 'asc' | 'desc';

const headCells: Array<{ id: SortKey; label: string; numeric?: boolean }> = [
  { id: 'name', label: 'Name' },
  { id: 'email', label: 'Email Address' },
  { id: 'contact', label: 'Contact' },
  { id: 'petsCount', label: 'Pets', numeric: true },
];

const tableContainerSx = {
  borderRadius: 2.5,
  border: '1px solid',
  borderColor: 'grey.200',
};

export default function UsersTable(props: { adminRole: AdminRole }) {
  void props.adminRole;
  const router = useRouter();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const loadUsers = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');

      const headers = await getAuthHeaders();
      const response = await fetch('/api/users', {
        method: 'GET',
        headers,
      });

      const data = (await response.json().catch(() => null)) as
        | { users?: UserRow[]; error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to load users.');
        return;
      }

      setRows(data?.users ?? []);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadUsers();
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const searched = !normalizedSearch
      ? rows
      : rows.filter((row) =>
          [row.name, row.email, row.contact, row.address].some((value) =>
            value.toLowerCase().includes(normalizedSearch)
          )
        );

    return [...searched].sort((left, right) => {
      const leftValue = left[sortKey];
      const rightValue = right[sortKey];

      const comparison =
        typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue));

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
            User Directory
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Monitor registered mobile users, review their profiles, and inspect the pets linked to each account.
          </Typography>
        </Box>

        <TextField
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          placeholder="Search name, email, contact, or address"
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

      <TableContainer sx={{ ...tableContainerSx, maxHeight: 520 }}>
        <Table stickyHeader size="small" aria-label="users table">
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
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" py={5}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Loading users...
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
                      No users found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Try adjusting your search or check whether user data already exists in Firebase.
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
                    onClick={() => router.push(`/users/${row.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ py: 1.25 }}>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Box
                          component="img"
                          src={row.profilePic}
                          alt={row.name}
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '1px solid',
                            borderColor: 'grey.200',
                          }}
                        />
                        <Box>
                          <Typography variant="body2" fontWeight={700} lineHeight={1.25}>
                            {row.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {row.address}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>{row.email}</TableCell>
                    <TableCell sx={{ py: 1.25 }}>{row.contact}</TableCell>
                    <TableCell sx={{ py: 1.25 }} align="right">{row.petsCount}</TableCell>
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
  );
}
