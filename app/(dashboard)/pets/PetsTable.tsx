'use client';

import Link from 'next/link';
import { useEffect, useEffectEvent, useMemo, useState, useTransition } from 'react';
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
import type { AdminRole } from '@/lib/auth/types';
import { auth } from '@/lib/firebase';
import { DeleteOutlineIcon, SearchIcon, VisibilityRoundedIcon } from '@/components/icons';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';

type PetRow = {
  id: string;
  name: string;
  type: string;
  breed: string;
  birthdate: string;
  image: string;
  owner: string;
  address: string;
  contact: string;
};

type SortKey = 'name' | 'type' | 'breed' | 'owner';
type SortOrder = 'asc' | 'desc';

const headCells: Array<{ id: SortKey; label: string }> = [
  { id: 'name', label: 'Name' },
  { id: 'type', label: 'Type' },
  { id: 'breed', label: 'Breed' },
  { id: 'owner', label: 'Owner' },
];

const tableContainerSx = {
  borderRadius: 2.5,
  border: '1px solid',
  borderColor: 'grey.200',
};

export default function PetsTable({ adminRole }: { adminRole: AdminRole }) {
  const [rows, setRows] = useState<PetRow[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<PetRow | null>(null);

  const canDelete = adminRole === 'super_admin';

  const loadPets = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/pets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as
        | { pets?: PetRow[]; error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to load pets.');
        return;
      }

      setRows(data?.pets ?? []);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load pets.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadPets();
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const searched = !normalizedSearch
      ? rows
      : rows.filter((row) =>
          [row.name, row.type, row.breed, row.owner, row.address].some((value) =>
            value.toLowerCase().includes(normalizedSearch)
          )
        );

    return [...searched].sort((left, right) => {
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

  const handleDeletePet = (pet: PetRow) => {
    if (!canDelete) {
      return;
    }
    setDeleteTarget(pet);
  };

  const confirmDeletePet = () => {
    if (!deleteTarget) {
      return;
    }
    startTransition(async () => {
      try {
        setMessage('');
        setError('');

        const currentUser = auth.currentUser;

        if (!currentUser) {
          setError('Your session expired. Please sign in again.');
          return;
        }

        const idToken = await currentUser.getIdToken();
        const response = await fetch(`/api/pets/${deleteTarget.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        });

        const data = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          setError(data?.error || 'Failed to delete pet.');
          return;
        }

        setRows((currentRows) => currentRows.filter((row) => row.id !== deleteTarget.id));
        setMessage(`${deleteTarget.name} was deleted successfully.`);
        setDeleteTarget(null);
      } catch (deleteError) {
        console.error(deleteError);
        setError('Failed to delete pet.');
      }
    });
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
            Pet Directory
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Review registered pets, their owner details, and their basic profile information from the mobile app.
          </Typography>
        </Box>

        <TextField
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          placeholder="Search name, type, breed, owner, or address"
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
        <Table stickyHeader size="small" aria-label="pets table">
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
                      Loading pets...
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
                      No pets found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Try adjusting your search or check whether pet data already exists in Firebase.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : null}

            {!loading
              ? paginatedRows.map((row) => (
                  <TableRow hover key={row.id}>
                    <TableCell sx={{ py: 1.25 }}>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Box
                          component="img"
                          src={row.image}
                          alt={row.name}
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 2,
                            objectFit: 'cover',
                            border: '1px solid',
                            borderColor: 'grey.200',
                          }}
                        />
                        <Typography variant="body2" fontWeight={700} lineHeight={1.25}>
                          {row.name}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>{row.type}</TableCell>
                    <TableCell sx={{ py: 1.25 }}>{row.breed}</TableCell>
                    <TableCell sx={{ py: 1.25 }}>{row.owner}</TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Stack direction="row" spacing={0.75}>
                        <Button
                          size="small"
                          variant="outlined"
                          component={Link}
                          href={`/pets/${row.id}`}
                          startIcon={<VisibilityRoundedIcon fontSize="small" />}
                          sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
                        >
                          View
                        </Button>
                        {canDelete ? (
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => handleDeletePet(row)}
                            startIcon={<DeleteOutlineIcon fontSize="small" />}
                            disabled={isPending}
                            sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
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
        title="Delete pet record?"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.name}? This removes the pet record from the database.`
            : ''
        }
        confirmLabel="Delete pet"
        loading={isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeletePet}
      />
    </Paper>
  );
}
