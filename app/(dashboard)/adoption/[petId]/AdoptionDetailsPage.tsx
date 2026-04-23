'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import type { AdminRole } from '@/lib/auth/types';
import { auth } from '@/lib/firebase';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { DetailCard, DetailInfoRow, DetailPageHeader } from '@/components/DetailPageScaffold';
import {
  CheckCircleRoundedIcon,
  CloseRoundedIcon,
  DeleteOutlineIcon,
  DoNotDisturbOnRoundedIcon,
  EditRoundedIcon,
  RequestPageRoundedIcon,
} from '@/components/icons';
import AdoptionPetFormDialog from '../AdoptionPetFormDialog';
import type { AdoptionBreedOptions, AdoptionPetFormPayload, AdoptionPetRow, AdoptionRequestRow } from '../types';

type AdoptionDetailsPageProps = {
  petId: string;
  adminRole: AdminRole;
  adminUid: string;
  adminName?: string;
  adminEmail: string;
};

export default function AdoptionDetailsPage({ petId, adminRole, adminUid, adminName, adminEmail }: AdoptionDetailsPageProps) {
  const router = useRouter();
  const [pet, setPet] = useState<AdoptionPetRow | null>(null);
  const [requests, setRequests] = useState<AdoptionRequestRow[]>([]);
  const [breedOptions, setBreedOptions] = useState<AdoptionBreedOptions>({
    dogBreeds: [],
    catBreeds: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [requestTarget, setRequestTarget] = useState<AdoptionRequestRow | null>(null);
  const [requestAction, setRequestAction] = useState<'accept' | 'reject'>('accept');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
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

  const loadDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const headers = await getAuthHeaders();
      const [petResponse, metaResponse] = await Promise.all([
        fetch(`/api/adoptions/${petId}`, { headers }),
        fetch('/api/adoptions/meta', { headers }),
      ]);
      const petData = (await petResponse.json().catch(() => null)) as
        | { pet?: AdoptionPetRow; error?: string }
        | null;
      const metaData = (await metaResponse.json().catch(() => null)) as
        | { dogBreeds?: string[]; catBreeds?: string[]; error?: string }
        | null;

      if (!petResponse.ok || !petData?.pet) {
        setError(petData?.error || 'Failed to load adoption details.');
        return;
      }

      if (metaResponse.ok) {
        setBreedOptions({
          dogBreeds: metaData?.dogBreeds ?? [],
          catBreeds: metaData?.catBreeds ?? [],
        });
      }

      setPet(petData.pet);

      if (petData.pet.status === 'shelter') {
        const requestsResponse = await fetch(`/api/adoptions/${petId}/requests`, { headers });
        const requestData = (await requestsResponse.json().catch(() => null)) as
          | { requests?: AdoptionRequestRow[]; error?: string }
          | null;

        if (!requestsResponse.ok) {
          setError(requestData?.error || 'Failed to load adoption requests.');
          return;
        }

        setRequests(requestData?.requests ?? []);
      } else {
        setRequests([]);
      }
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load adoption details.');
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const resolveRequest = async () => {
    if (!requestTarget) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/adoptions/${petId}/requests`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          requestId: requestTarget.id,
          userId: requestTarget.userId,
          action: requestAction,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to update adoption request.');
        return;
      }

      if (requestAction === 'accept') {
        setMessage(`${requestTarget.requesterName}'s adoption request was accepted.`);
        await loadDetails();
      } else {
        setRequests((current) => current.filter((row) => row.id !== requestTarget.id));
        setMessage(`${requestTarget.requesterName}'s adoption request was rejected.`);
      }

      setRequestTarget(null);
    } catch (requestError) {
      console.error(requestError);
      setError('Failed to update adoption request.');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async () => {
    if (!pet) {
      return;
    }

    try {
      setSaving(true);
      setError('');

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/adoptions/${pet.id}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ status: pet.status }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to delete adoption record.');
        return;
      }

      router.push('/adoption');
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to delete adoption record.');
    } finally {
      setSaving(false);
    }
  };

  const updatePet = async (payload: AdoptionPetFormPayload) => {
    if (!pet) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/adoptions/${pet.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as { pet?: AdoptionPetRow; error?: string } | null;

      if (!response.ok || !data?.pet) {
        setError(data?.error || 'Failed to update adoption pet.');
        return;
      }

      setPet(data.pet);
      setMessage('Adoption pet updated successfully.');
      setEditOpen(false);
    } catch (submitError) {
      console.error(submitError);
      setError('Failed to update adoption pet.');
    } finally {
      setSaving(false);
    }
  };

  const submitDeleteRequest = async () => {
    if (!pet) {
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
          petId: pet.id,
          petName: pet.petName,
          petStatus: pet.status,
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

      setPet((current) => (current ? { ...current, requestStatus: 'pending' } : current));
      setMessage(`Delete request submitted for ${pet.petName}.`);
      setRequestDeleteOpen(false);
    } catch (requestError) {
      console.error(requestError);
      setError('Failed to submit adoption delete request.');
    } finally {
      setSaving(false);
    }
  };

  const cancelDeleteRequest = async () => {
    if (!pet) {
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
          petId: pet.id,
          petStatus: pet.status,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to cancel adoption delete request.');
        return;
      }

      setPet((current) => (current ? { ...current, requestStatus: null } : current));
      setMessage(`Delete request canceled for ${pet.petName}.`);
      setCancelRequestOpen(false);
    } catch (cancelError) {
      console.error(cancelError);
      setError('Failed to cancel adoption delete request.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack direction="row" spacing={1.5} alignItems="center">
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading adoption details...
        </Typography>
      </Stack>
    );
  }

  if (!pet) {
    return <Alert severity="error">{error || 'Adoption record not found.'}</Alert>;
  }

  const petRows = [
    ['Age', pet.petAge],
    ['Type', pet.type],
    ['Gender', pet.gender],
    ['Breed', pet.breed],
    ...(pet.status === 'adopted'
      ? [
          ['Adopted by', pet.adopterName || 'Unknown'],
          ['Email', pet.adopterEmail || 'Unknown'],
          ['Contact', pet.adopterContact || 'Unknown'],
          ['Address', pet.adopterAddress || 'Unknown'],
          ['Adopted at', pet.adoptedAt || 'Unknown'],
        ]
      : []),
  ];

  return (
    <Stack spacing={2.5}>
      <DetailPageHeader
        title="Adoption Information"
        description="Review this adoption pet record, adopter details, and mobile adoption requests."
        backLabel="Back to adoption"
        onBack={() => router.push('/adoption')}
        action={
          <Stack direction="row" spacing={0.75} flexWrap="wrap">
            {pet.status === 'shelter' ? (
              <Button
                color="warning"
                variant="outlined"
                size="small"
                startIcon={<EditRoundedIcon fontSize="small" />}
                onClick={() => setEditOpen(true)}
                sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
              >
                Edit
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                color="error"
                variant="outlined"
                size="small"
                startIcon={<DeleteOutlineIcon fontSize="small" />}
                onClick={() => setDeleteOpen(true)}
                sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
              >
                Delete
              </Button>
            ) : (
              <Button
                color="error"
                variant="outlined"
                size="small"
                startIcon={
                  pet.requestStatus === 'pending' ? (
                    <CloseRoundedIcon fontSize="small" />
                  ) : (
                    <RequestPageRoundedIcon fontSize="small" />
                  )
                }
                onClick={() =>
                  pet.requestStatus === 'pending' ? setCancelRequestOpen(true) : setRequestDeleteOpen(true)
                }
                sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
              >
                {pet.requestStatus === 'pending' ? 'Cancel Request' : 'Request Delete'}
              </Button>
            )}
          </Stack>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {message ? <Alert severity="success">{message}</Alert> : null}

      <DetailCard>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5}>
          <Box
            component="img"
            src={pet.profileURL}
            alt={pet.petName}
            sx={{
              width: { xs: 110, md: 132 },
              height: { xs: 110, md: 132 },
              borderRadius: 2.5,
              objectFit: 'cover',
              border: '1px solid',
              borderColor: 'grey.200',
            }}
          />

          <Box flex={1}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="h5" fontWeight={800}>
                {pet.petName}
              </Typography>
              <Chip
                size="small"
                label={pet.status === 'shelter' ? 'In shelter' : 'Adopted'}
                color={pet.status === 'shelter' ? 'warning' : 'success'}
                variant="outlined"
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {pet.description}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Stack spacing={0.75}>
              {petRows.map(([label, value]) => (
                <DetailInfoRow key={label} label={label} value={value} />
              ))}
            </Stack>
          </Box>
        </Stack>
      </DetailCard>

      {pet.status === 'shelter' ? (
        <DetailCard>
          <Typography variant="h6" fontWeight={700}>
            Adoption Requests
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>
            Review mobile user requests and accept or reject them.
          </Typography>

          <Stack spacing={1.25}>
            {requests.length === 0 ? (
              <Box py={3} textAlign="center">
                <Typography variant="subtitle1" fontWeight={700}>
                  No requests yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  Adoption requests for this pet will appear here.
                </Typography>
              </Box>
            ) : null}

            {requests.map((request) => (
              <Card key={request.id} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" fontWeight={700}>
                        {request.requesterName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="div">
                        {request.requesterEmail} | {request.requesterContact}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="div">
                        Requested at: {request.requestedAt}
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={0.75}>
                      <Button
                        size="small"
                        color="success"
                        variant="outlined"
                        startIcon={<CheckCircleRoundedIcon fontSize="small" />}
                        sx={{ minWidth: 0, px: 0.85, py: 0.25, fontSize: '0.7rem' }}
                        onClick={() => {
                          setRequestTarget(request);
                          setRequestAction('accept');
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        startIcon={<DoNotDisturbOnRoundedIcon fontSize="small" />}
                        sx={{ minWidth: 0, px: 0.85, py: 0.25, fontSize: '0.7rem' }}
                        onClick={() => {
                          setRequestTarget(request);
                          setRequestAction('reject');
                        }}
                      >
                        Reject
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </DetailCard>
      ) : null}

      <ConfirmDeleteDialog
        open={!!requestTarget}
        title={requestAction === 'accept' ? 'Accept adoption request?' : 'Reject adoption request?'}
        description={
          requestTarget
            ? requestAction === 'accept'
              ? `Accept ${requestTarget.requesterName}'s adoption request for ${pet.petName}?`
              : `Reject ${requestTarget.requesterName}'s adoption request for ${pet.petName}?`
            : ''
        }
        confirmLabel={requestAction === 'accept' ? 'Accept request' : 'Reject request'}
        confirmColor={requestAction === 'accept' ? 'success' : 'error'}
        confirmIcon={requestAction === 'accept' ? 'check' : 'delete'}
        loading={saving}
        onClose={() => setRequestTarget(null)}
        onConfirm={() => void resolveRequest()}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Delete adoption record?"
        description={`Delete ${pet.petName}? This removes the adoption record from the database.`}
        confirmLabel="Delete record"
        loading={saving}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void deleteRecord()}
      />

      <ConfirmDeleteDialog
        open={requestDeleteOpen}
        title="Request adoption deletion?"
        description={`Send a delete request for ${pet.petName}? A super admin will review it before removal.`}
        confirmLabel="Send request"
        loading={saving}
        onClose={() => setRequestDeleteOpen(false)}
        onConfirm={() => void submitDeleteRequest()}
      />

      <ConfirmDeleteDialog
        open={cancelRequestOpen}
        title="Cancel delete request?"
        description={`Cancel the pending delete request for ${pet.petName}?`}
        confirmLabel="Cancel request"
        confirmColor="warning"
        confirmIcon="close"
        loading={saving}
        onClose={() => setCancelRequestOpen(false)}
        onConfirm={() => void cancelDeleteRequest()}
      />

      <AdoptionPetFormDialog
        key={`${pet.id}-${editOpen ? 'open' : 'closed'}`}
        open={editOpen}
        mode="edit"
        pet={pet}
        breedOptions={breedOptions}
        loading={saving}
        onClose={() => setEditOpen(false)}
        onSubmit={updatePet}
      />
    </Stack>
  );
}
