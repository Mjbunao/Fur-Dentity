'use client';

import { useEffect, useEffectEvent, useMemo, useState, useTransition } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { DeleteOutlineIcon, SearchIcon, VisibilityRoundedIcon } from '@/components/icons';

type UserRow = {
  id: string;
  name: string;
  email: string;
  contact: string;
  address: string;
  profilePic: string;
  petsCount: number;
};

type UserDetails = {
  user: {
    id: string;
    name: string;
    email: string;
    contact: string;
    address: string;
    profilePic: string;
  };
  pets: Array<{
    id: string;
    name: string;
    type: string;
    breed: string;
    age: string;
    image: string;
    colors: string[];
  }>;
};

type SortKey = 'name' | 'email' | 'contact' | 'petsCount';
type SortOrder = 'asc' | 'desc';

const headCells: Array<{ id: SortKey; label: string; numeric?: boolean }> = [
  { id: 'name', label: 'Name' },
  { id: 'email', label: 'Email Address' },
  { id: 'contact', label: 'Contact' },
  { id: 'petsCount', label: 'Registered Pets', numeric: true },
];

const tableContainerSx = {
  borderRadius: 4,
  border: '1px solid',
  borderColor: 'grey.200',
};

export default function UsersTable({ adminRole }: { adminRole: AdminRole }) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [isPending, startTransition] = useTransition();

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

  const handleViewUser = async (userId: string) => {
    try {
      setDetailsLoading(true);
      setDetailsError('');
      setDetailsOpen(true);

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/users/${userId}`, {
        method: 'GET',
        headers,
      });

      const data = (await response.json().catch(() => null)) as
        | (UserDetails & { error?: string })
        | null;

      if (!response.ok || !data?.user) {
        setDetailsError(data?.error || 'Failed to load user details.');
        setSelectedUser(null);
        return;
      }

      setSelectedUser({
        user: data.user,
        pets: data.pets ?? [],
      });
    } catch (viewError) {
      console.error(viewError);
      setDetailsError('Failed to load user details.');
      setSelectedUser(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleDeleteUser = (user: UserRow) => {
    if (!canDelete) {
      return;
    }

    const confirmed = window.confirm(`Delete ${user.name}? This removes the user record from the database.`);

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      try {
        setMessage('');
        setError('');

        const headers = await getAuthHeaders();
        const response = await fetch(`/api/users/${user.id}`, {
          method: 'DELETE',
          headers,
        });

        const data = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          setError(data?.error || 'Failed to delete user.');
          return;
        }

        setRows((currentRows) => currentRows.filter((row) => row.id !== user.id));
        setMessage(`${user.name} was deleted successfully.`);
      } catch (deleteError) {
        console.error(deleteError);
        setError('Failed to delete user.');
      }
    });
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'grey.200',
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h5" fontWeight={700} color="text.primary">
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
          sx={{ minWidth: { xs: '100%', md: 340 } }}
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

      <TableContainer sx={{ ...tableContainerSx, maxHeight: 560 }}>
        <Table stickyHeader aria-label="users table">
          <TableHead>
            <TableRow>
              {headCells.map((cell) => (
                <TableCell
                  key={cell.id}
                  sortDirection={sortKey === cell.id ? sortOrder : false}
                  align={cell.numeric ? 'right' : 'left'}
                  sx={{ bgcolor: 'background.paper', fontWeight: 700 }}
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
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" py={6}>
                    <CircularProgress size={22} />
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
                  <Box py={6} textAlign="center">
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
                  <TableRow hover key={row.id}>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                          component="img"
                          src={row.profilePic}
                          alt={row.name}
                          sx={{
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '1px solid',
                            borderColor: 'grey.200',
                          }}
                        />
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            {row.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {row.address}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell>{row.contact}</TableCell>
                    <TableCell align="right">{row.petsCount}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => void handleViewUser(row.id)}
                          startIcon={<VisibilityRoundedIcon fontSize="small" />}
                        >
                          View
                        </Button>
                        {canDelete ? (
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => handleDeleteUser(row)}
                            startIcon={<DeleteOutlineIcon fontSize="small" />}
                            disabled={isPending}
                          >
                            Delete
                          </Button>
                        ) : null}
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
      />

      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>User Profile Information</DialogTitle>
        <DialogContent dividers>
          {detailsLoading ? (
            <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" py={6}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">
                Loading user details...
              </Typography>
            </Stack>
          ) : null}

          {!detailsLoading && detailsError ? (
            <Alert severity="error">{detailsError}</Alert>
          ) : null}

          {!detailsLoading && selectedUser ? (
            <Stack spacing={3}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, md: 3 },
                  borderRadius: 4,
                  border: '1px solid',
                  borderColor: 'grey.200',
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ xs: 'center', md: 'flex-start' }}>
                  <Box
                    component="img"
                    src={selectedUser.user.profilePic}
                    alt={selectedUser.user.name}
                    sx={{
                      width: 120,
                      height: 120,
                      borderRadius: 4,
                      objectFit: 'cover',
                      border: '1px solid',
                      borderColor: 'grey.200',
                    }}
                  />

                  <Stack spacing={1.25} sx={{ width: '100%' }}>
                    <Typography variant="h6" fontWeight={700}>
                      {selectedUser.user.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Email: {selectedUser.user.email}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Contact: {selectedUser.user.contact}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Address: {selectedUser.user.address}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>

              <Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                  Registered Pets
                </Typography>

                {selectedUser.pets.length === 0 ? (
                  <Alert severity="info">No pets found for this user.</Alert>
                ) : (
                  <Stack spacing={1.5}>
                    {selectedUser.pets.map((pet) => (
                      <Paper
                        key={pet.id}
                        elevation={0}
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          border: '1px solid',
                          borderColor: 'grey.200',
                        }}
                      >
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                          <Box
                            component="img"
                            src={pet.image}
                            alt={pet.name}
                            sx={{
                              width: 92,
                              height: 92,
                              borderRadius: 3,
                              objectFit: 'cover',
                              border: '1px solid',
                              borderColor: 'grey.200',
                            }}
                          />
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" fontWeight={700}>
                              {pet.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Type: {pet.type}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Breed: {pet.breed}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Age: {pet.age}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
                              {pet.colors.length > 0 ? (
                                pet.colors.map((color) => (
                                  <Chip
                                    key={`${pet.id}-${color}`}
                                    size="small"
                                    label={color}
                                    sx={{
                                      bgcolor: color,
                                      color: '#111827',
                                      border: '1px solid rgba(15, 23, 42, 0.14)',
                                      textTransform: 'capitalize',
                                    }}
                                  />
                                ))
                              ) : (
                                <Chip size="small" label="No colors listed" />
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
