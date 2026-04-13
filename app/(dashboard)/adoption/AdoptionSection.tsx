'use client';

import Link from 'next/link';
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
  CloseRoundedIcon,
  DeleteOutlineIcon,
  EditRoundedIcon,
  RequestPageRoundedIcon,
  SearchIcon,
  VisibilityRoundedIcon,
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
  border: '1px solid',
  borderColor: 'grey.200',
  maxHeight: 520,
};

export default function AdoptionSection({ adminRole, adminUid, adminName, adminEmail }: AdoptionSectionProps) {
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
  const [deleteTarget, setDeleteTarget] = useState<AdoptionPetRow | null>(null);
  const [requestDeleteTarget, setRequestDeleteTarget] = useState<AdoptionPetRow | null>(null);
  const [cancelRequestTarget, setCancelRequestTarget] = useState<AdoptionPetRow | null>(null);
  const [reviewRequestTarget, setReviewRequestTarget] = useState<AdoptionDeleteRequestRow | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');

  const canDelete = adminRole === 'super_admin';
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

  const openEditDialog = (pet: AdoptionPetRow) => {
    setFormMode('edit');
    setSelectedPet(pet);
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

  const confirmDeletePet = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/adoptions/${deleteTarget.id}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ status: deleteTarget.status }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to delete adoption record.');
        return;
      }

      if (deleteTarget.status === 'shelter') {
        setShelterRows((current) => current.filter((row) => row.id !== deleteTarget.id));
      } else {
        setAdoptedRows((current) => current.filter((row) => row.id !== deleteTarget.id));
      }

      setMessage(`${deleteTarget.petName} was deleted successfully.`);
      setDeleteTarget(null);
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to delete adoption record.');
    } finally {
      setSaving(false);
    }
  };

  const submitDeleteRequest = async () => {
    if (!requestDeleteTarget) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch('/api/adoptions/delete-requests', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          petId: requestDeleteTarget.id,
          petName: requestDeleteTarget.petName,
          petStatus: requestDeleteTarget.status,
          requestedByUid: adminUid,
          requestedByName: adminName || 'System Admin',
          requestedByEmail: adminEmail,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to submit adoption delete request.');
        return;
      }

      const updateRows = (current: AdoptionPetRow[]) =>
        current.map((row) =>
          row.id === requestDeleteTarget.id ? { ...row, requestStatus: 'pending' as const } : row
        );

      if (requestDeleteTarget.status === 'shelter') {
        setShelterRows(updateRows);
      } else {
        setAdoptedRows(updateRows);
      }

      setMessage(`Delete request submitted for ${requestDeleteTarget.petName}.`);
      setRequestDeleteTarget(null);
    } catch (requestError) {
      console.error(requestError);
      setError('Failed to submit adoption delete request.');
    } finally {
      setSaving(false);
    }
  };

  const cancelDeleteRequest = async () => {
    if (!cancelRequestTarget) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch('/api/adoptions/delete-requests', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          petId: cancelRequestTarget.id,
          petStatus: cancelRequestTarget.status,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to cancel adoption delete request.');
        return;
      }

      const resetRows = (current: AdoptionPetRow[]) =>
        current.map((row) =>
          row.id === cancelRequestTarget.id ? { ...row, requestStatus: null } : row
        );

      if (cancelRequestTarget.status === 'shelter') {
        setShelterRows(resetRows);
      } else {
        setAdoptedRows(resetRows);
      }

      setMessage(`Delete request canceled for ${cancelRequestTarget.petName}.`);
      setCancelRequestTarget(null);
    } catch (cancelError) {
      console.error(cancelError);
      setError('Failed to cancel adoption delete request.');
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
    <Stack spacing={3}>
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
        direction={{ xs: 'column', lg: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', lg: 'center' }}
        sx={{ mb: 2.25 }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Adoption Directory
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Manage shelter pets, adoption requests, and completed adoptions from one server-backed view.
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
        sx={{ mb: 2 }}
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
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700, py: 1.25 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6}>
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
                <TableCell colSpan={6}>
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
                  <TableRow hover key={`${row.status}-${row.id}`}>
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
                    <TableCell sx={{ py: 1.25 }}>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap">
                        <Button
                          size="small"
                          variant="outlined"
                          component={Link}
                          href={`/adoption/${row.id}?status=${row.status}`}
                          startIcon={<VisibilityRoundedIcon fontSize="small" />}
                          sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
                        >
                          View
                        </Button>
                        {row.status === 'shelter' ? (
                          <Button
                            size="small"
                            color="warning"
                            variant="outlined"
                            onClick={() => openEditDialog(row)}
                            startIcon={<EditRoundedIcon fontSize="small" />}
                            sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => setDeleteTarget(row)}
                            startIcon={<DeleteOutlineIcon fontSize="small" />}
                            sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
                          >
                            Delete
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() =>
                              row.requestStatus === 'pending'
                                ? setCancelRequestTarget(row)
                                : setRequestDeleteTarget(row)
                            }
                            startIcon={
                              row.requestStatus === 'pending' ? (
                                <CloseRoundedIcon fontSize="small" />
                              ) : (
                                <RequestPageRoundedIcon fontSize="small" />
                              )
                            }
                            sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
                          >
                            {row.requestStatus === 'pending' ? 'Cancel Request' : 'Request Delete'}
                          </Button>
                        )}
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
        open={!!deleteTarget}
        title="Delete adoption record?"
        description={
          deleteTarget
            ? `Delete ${deleteTarget.petName}? This removes the ${deleteTarget.status === 'adopted' ? 'adopted' : 'shelter'} adoption record.`
            : ''
        }
        confirmLabel="Delete record"
        loading={saving}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeletePet()}
      />

      <ConfirmDeleteDialog
        open={!!requestDeleteTarget}
        title="Request adoption deletion?"
        description={
          requestDeleteTarget
            ? `Send a delete request for ${requestDeleteTarget.petName}? A super admin will review it before removal.`
            : ''
        }
        confirmLabel="Send request"
        loading={saving}
        onClose={() => setRequestDeleteTarget(null)}
        onConfirm={() => void submitDeleteRequest()}
      />

      <ConfirmDeleteDialog
        open={!!cancelRequestTarget}
        title="Cancel delete request?"
        description={cancelRequestTarget ? `Cancel the pending delete request for ${cancelRequestTarget.petName}?` : ''}
        confirmLabel="Cancel request"
        confirmColor="warning"
        confirmIcon="close"
        loading={saving}
        onClose={() => setCancelRequestTarget(null)}
        onConfirm={() => void cancelDeleteRequest()}
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
