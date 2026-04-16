'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Chip,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Tabs,
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
import AdoptionPetFormDialog from './AdoptionPetFormDialog';
import AdoptionDeleteRequestsTable from './AdoptionDeleteRequestsTable';
import type {
  AdoptionBreedOptions,
  AdoptionDeleteRequestRow,
  AdoptionPetFormPayload,
  AdoptionPetRow,
  AdoptionPetStatus,
  AdoptionSectionProps,
} from './types';

type SortKey = 'petName' | 'type' | 'breed' | 'requestCount';
type SortOrder = 'asc' | 'desc';

const headCells: Array<{ id: SortKey; label: string; numeric?: boolean }> = [
  { id: 'petName', label: 'Name' },
  { id: 'type', label: 'Type' },
  { id: 'breed', label: 'Breed' },
  { id: 'requestCount', label: 'Requests', numeric: true },
];

const tableContainerSx = {
  borderRadius: 2.5,
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
  maxHeight: 520,
};

export default function AdoptionSection({ adminRole, adminUid, adminName, adminEmail }: AdoptionSectionProps) {
  const router = useRouter();
  const [shelterRows, setShelterRows] = useState<AdoptionPetRow[]>([]);
  const [adoptedRows, setAdoptedRows] = useState<AdoptionPetRow[]>([]);
  const [requests, setRequests] = useState<AdoptionDeleteRequestRow[]>([]);
  const [breedOptions, setBreedOptions] = useState<AdoptionBreedOptions>({
    dogBreeds: [],
    catBreeds: [],
  });
  const [activeTab, setActiveTab] = useState<AdoptionPetStatus>('shelter');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>('petName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [error, setError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [message, setMessage] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedPet, setSelectedPet] = useState<AdoptionPetRow | null>(null);
  const [reviewRequestTarget, setReviewRequestTarget] = useState<AdoptionDeleteRequestRow | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');

  void adminUid;
  void adminName;
  void adminEmail;
  const rows = activeTab === 'shelter' ? shelterRows : adoptedRows;

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

  const loadAdoptions = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');

      const headers = await getAuthHeaders();
      const [response, metaResponse] = await Promise.all([
        fetch('/api/adoptions', { headers }),
        fetch('/api/adoptions/meta', { headers }),
      ]);
      const data = (await response.json().catch(() => null)) as
        | { shelterPets?: AdoptionPetRow[]; adoptedPets?: AdoptionPetRow[]; error?: string }
        | null;
      const metaData = (await metaResponse.json().catch(() => null)) as
        | { dogBreeds?: string[]; catBreeds?: string[]; error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to load adoption records.');
        return;
      }

      if (!metaResponse.ok) {
        setError(metaData?.error || 'Failed to load adoption form data.');
        return;
      }

      setShelterRows(data?.shelterPets ?? []);
      setAdoptedRows(data?.adoptedPets ?? []);
      setBreedOptions({
        dogBreeds: metaData?.dogBreeds ?? [],
        catBreeds: metaData?.catBreeds ?? [],
      });
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load adoption records.');
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
      const response = await fetch('/api/adoptions/delete-requests', { headers });
      const data = (await response.json().catch(() => null)) as
        | { requests?: AdoptionDeleteRequestRow[]; error?: string }
        | null;

      if (!response.ok) {
        setRequestError(data?.error || 'Failed to load adoption delete requests.');
        return;
      }

      setRequests(data?.requests ?? []);
    } catch (loadError) {
      console.error(loadError);
      setRequestError('Failed to load adoption delete requests.');
    } finally {
      setRequestLoading(false);
    }
  });

  useEffect(() => {
    void loadAdoptions();
    void loadDeleteRequests();
  }, [adminRole]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const searched = !normalizedSearch
      ? rows
      : rows.filter((row) =>
          [row.petName, row.type, row.gender, row.breed, row.description, row.adopterName ?? ''].some((value) =>
            value.toLowerCase().includes(normalizedSearch)
          )
        );

    return [...searched].sort((left, right) => {
      const comparison =
        sortKey === 'requestCount'
          ? left.requestCount - right.requestCount
          : String(left[sortKey]).localeCompare(String(right[sortKey]));
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
    setSortOrder(property === 'requestCount' ? 'desc' : 'asc');
  };

  const openCreateDialog = () => {
    setFormMode('create');
    setSelectedPet(null);
    setFormOpen(true);
  };

  const handleSubmitPet = async (payload: AdoptionPetFormPayload) => {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch(
        formMode === 'create' ? '/api/adoptions' : `/api/adoptions/${selectedPet?.id}`,
        {
          method: formMode === 'create' ? 'POST' : 'PATCH',
          headers,
          body: JSON.stringify(payload),
        }
      );
      const data = (await response.json().catch(() => null)) as { pet?: AdoptionPetRow; error?: string } | null;

      if (!response.ok || !data?.pet) {
        setError(data?.error || 'Failed to save adoption pet.');
        return;
      }

      if (formMode === 'create') {
        setShelterRows((current) => [data.pet as AdoptionPetRow, ...current]);
        setMessage('Adoption pet created successfully.');
      } else {
        setShelterRows((current) =>
          current.map((row) => (row.id === data.pet?.id ? (data.pet as AdoptionPetRow) : row))
        );
        setMessage('Adoption pet updated successfully.');
      }

      setFormOpen(false);
      setSelectedPet(null);
    } catch (submitError) {
      console.error(submitError);
      setError('Failed to save adoption pet.');
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
      const response = await fetch(`/api/adoptions/delete-requests/${reviewRequestTarget.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ action: reviewAction }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setRequestError(data?.error || 'Failed to update adoption delete request.');
        return;
      }

      if (reviewAction === 'approve') {
        if (reviewRequestTarget.petStatus === 'shelter') {
          setShelterRows((current) => current.filter((row) => row.id !== reviewRequestTarget.petId));
        } else {
          setAdoptedRows((current) => current.filter((row) => row.id !== reviewRequestTarget.petId));
        }
        setMessage(`Adoption record deleted after approving the request for ${reviewRequestTarget.petName}.`);
      } else {
        const resetRows = (current: AdoptionPetRow[]) =>
          current.map((row) =>
            row.id === reviewRequestTarget.petId ? { ...row, requestStatus: 'rejected' as const } : row
          );
        if (reviewRequestTarget.petStatus === 'shelter') {
          setShelterRows(resetRows);
        } else {
          setAdoptedRows(resetRows);
        }
        setMessage(`Delete request rejected for ${reviewRequestTarget.petName}.`);
      }

      setRequests((current) => current.filter((row) => row.id !== reviewRequestTarget.id));
      setReviewRequestTarget(null);
    } catch (reviewError) {
      console.error(reviewError);
      setRequestError('Failed to update adoption delete request.');
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
            Adoption Directory
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage adoptable pets, pending adoption requests, and completed adoptions.
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <TextField
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Search pet, type, breed, or adopter"
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
          {activeTab === 'shelter' ? (
            <Button variant="contained" startIcon={<AddRoundedIcon sx={{ fontSize: 18 }} />} onClick={openCreateDialog}>
              Add pet
            </Button>
          ) : null}
        </Stack>
      </Stack>

      <Tabs
        value={activeTab}
        onChange={(_, nextValue: AdoptionPetStatus) => {
          setActiveTab(nextValue);
          setPage(0);
        }}
        sx={{ mb: 1.25 }}
      >
        <Tab value="shelter" label={`Shelter Pets (${shelterRows.length})`} />
        <Tab value="adopted" label={`Adopted Pets (${adoptedRows.length})`} />
      </Tabs>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}

      <TableContainer sx={tableContainerSx}>
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
                Status
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
                      Loading adoption records...
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
                      No adoption records found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Try adjusting your search or add the first pet for adoption.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : null}

            {!loading
              ? paginatedRows.map((row) => (
                  <TableRow
                    hover
                    key={`${row.status}-${row.id}`}
                    onClick={() => router.push(`/adoption/${row.id}?status=${row.status}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ py: 1.25 }}>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Box
                          component="img"
                          src={row.profileURL}
                          alt={row.petName}
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 2,
                            objectFit: 'cover',
                            border: '1px solid',
                            borderColor: 'grey.200',
                          }}
                        />
                        <Box>
                          <Typography variant="body2" fontWeight={700} lineHeight={1.25}>
                            {row.petName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {row.gender}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>{row.type}</TableCell>
                    <TableCell sx={{ py: 1.25 }}>{row.breed}</TableCell>
                    <TableCell sx={{ py: 1.25 }} align="right">
                      {row.status === 'shelter' ? row.requestCount : '-'}
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Chip
                        size="small"
                        label={row.status === 'shelter' ? 'In shelter' : 'Adopted'}
                        color={row.status === 'shelter' ? 'warning' : 'success'}
                        variant="outlined"
                      />
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

      <AdoptionPetFormDialog
        key={`${formMode}-${selectedPet?.id ?? 'new'}-${formOpen ? 'open' : 'closed'}`}
        open={formOpen}
        mode={formMode}
        pet={selectedPet}
        breedOptions={breedOptions}
        loading={saving}
        onClose={() => {
          setFormOpen(false);
          setSelectedPet(null);
        }}
        onSubmit={handleSubmitPet}
      />

      <ConfirmDeleteDialog
        open={!!reviewRequestTarget}
        title={reviewAction === 'approve' ? 'Approve delete request?' : 'Reject delete request?'}
        description={
          reviewRequestTarget
            ? reviewAction === 'approve'
              ? `Approve the request and delete ${reviewRequestTarget.petName}?`
              : `Reject the delete request for ${reviewRequestTarget.petName}?`
            : ''
        }
        confirmLabel={reviewAction === 'approve' ? 'Approve delete' : 'Reject request'}
        loading={saving}
        onClose={() => setReviewRequestTarget(null)}
        onConfirm={() => void handleReviewRequest()}
      />

      {adminRole === 'super_admin' ? (
        <AdoptionDeleteRequestsTable
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
    </Stack>
  );
}
