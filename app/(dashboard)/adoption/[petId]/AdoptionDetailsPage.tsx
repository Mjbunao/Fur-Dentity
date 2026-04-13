'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { AdminRole } from '@/lib/auth/types';
import { auth } from '@/lib/firebase';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import {
  ArrowBackRoundedIcon,
  CheckCircleRoundedIcon,
  DeleteOutlineIcon,
  DoNotDisturbOnRoundedIcon,
} from '@/components/icons';
import type { AdoptionPetRow, AdoptionRequestRow } from '../types';

type AdoptionDetailsPageProps = {
  petId: string;
  adminRole: AdminRole;
};

export default function AdoptionDetailsPage({ petId, adminRole }: AdoptionDetailsPageProps) {
  const [pet, setPet] = useState<AdoptionPetRow | null>(null);
  const [requests, setRequests] = useState<AdoptionRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [requestTarget, setRequestTarget] = useState<AdoptionRequestRow | null>(null);
  const [requestAction, setRequestAction] = useState<'accept' | 'reject'>('accept');
  const [deleteOpen, setDeleteOpen] = useState(false);

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
      const petResponse = await fetch(`/api/adoptions/${petId}`, { headers });
      const petData = (await petResponse.json().catch(() => null)) as
        | { pet?: AdoptionPetRow; error?: string }
        | null;

      if (!petResponse.ok || !petData?.pet) {
        setError(petData?.error || 'Failed to load adoption details.');
        return;
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

      window.location.href = '/adoption';
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to delete adoption record.');
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

  return (
    <Stack spacing={2.25}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
        <Button
          component={Link}
          href="/adoption"
          variant="text"
          size="small"
          startIcon={<ArrowBackRoundedIcon fontSize="small" />}
          sx={{ alignSelf: 'flex-start', px: 0.5 }}
        >
          Back to adoption
        </Button>

        {canDelete ? (
          <Button
            color="error"
            variant="outlined"
            size="small"
            startIcon={<DeleteOutlineIcon fontSize="small" />}
            onClick={() => setDeleteOpen(true)}
            sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
          >
            Delete
          </Button>
        ) : null}
      </Stack>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {message ? <Alert severity="success">{message}</Alert> : null}

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 2.5,
          border: '1px solid',
          borderColor: 'grey.200',
        }}
      >
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
              <Typography variant="body2"><strong>Age:</strong> {pet.petAge}</Typography>
              <Typography variant="body2"><strong>Type:</strong> {pet.type}</Typography>
              <Typography variant="body2"><strong>Gender:</strong> {pet.gender}</Typography>
              <Typography variant="body2"><strong>Breed:</strong> {pet.breed}</Typography>
              {pet.status === 'adopted' ? (
                <>
                  <Typography variant="body2"><strong>Adopted by:</strong> {pet.adopterName}</Typography>
                  <Typography variant="body2"><strong>Email:</strong> {pet.adopterEmail}</Typography>
                  <Typography variant="body2"><strong>Contact:</strong> {pet.adopterContact}</Typography>
                  <Typography variant="body2"><strong>Address:</strong> {pet.adopterAddress}</Typography>
                  <Typography variant="body2"><strong>Adopted at:</strong> {pet.adoptedAt}</Typography>
                </>
              ) : null}
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {pet.status === 'shelter' ? (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'grey.200',
          }}
        >
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
        </Paper>
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
    </Stack>
  );
}
