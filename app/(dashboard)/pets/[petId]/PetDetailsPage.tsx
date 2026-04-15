'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import type { AdminRole } from '@/lib/auth/types';
import { auth } from '@/lib/firebase';
import { DeleteOutlineIcon } from '@/components/icons';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { DetailCard, DetailInfoRow, DetailPageHeader } from '@/components/DetailPageScaffold';

type PetDetails = {
  pet: {
    id: string;
    name: string;
    type: string;
    breed: string;
    birthdate: string;
    image: string;
    owner: string;
    address: string;
    contact: string;
    colors: string[];
  };
};

export default function PetDetailsPage({
  petId,
  adminRole,
}: {
  petId: string;
  adminRole: AdminRole;
}) {
  const router = useRouter();
  const [details, setDetails] = useState<PetDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canDelete = adminRole === 'super_admin';

  const loadPetDetails = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch(`/api/pets/${petId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as
        | (PetDetails & { error?: string })
        | null;

      if (!response.ok || !data?.pet) {
        setError(data?.error || 'Failed to load pet details.');
        return;
      }

      setDetails({
        pet: data.pet,
      });
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load pet details.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadPetDetails();
  }, [petId]);

  const handleDeletePet = async () => {
    if (!canDelete || !details) {
      return;
    }

    try {
      setDeleting(true);
      setError('');

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch(`/api/pets/${petId}`, {
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

      router.push('/pets');
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to delete pet.');
    } finally {
      setDeleting(false);
    }
  };

  const petRows = details
    ? [
        ['Type', details.pet.type],
        ['Breed', details.pet.breed],
        ['Birthdate', details.pet.birthdate],
        ['Owner', details.pet.owner],
        ['Address', details.pet.address],
        ['Contact', details.pet.contact],
      ]
    : [];

  return (
    <Stack spacing={2.5}>
      <DetailPageHeader
        title="Pet Information"
        description="Review this pet's profile information together with the owner details from the mobile app."
        backLabel="Back to pets"
        onBack={() => router.push('/pets')}
        action={
          canDelete ? (
          <Button
            color="error"
            variant="outlined"
            size="small"
            startIcon={<DeleteOutlineIcon fontSize="small" />}
            onClick={() => setConfirmOpen(true)}
            disabled={deleting || loading}
            sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
          >
            Delete
          </Button>
          ) : null
        }
      />

      {loading ? (
        <DetailCard>
          <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Loading pet details...
            </Typography>
          </Stack>
        </DetailCard>
      ) : null}

      {!loading && error ? <Alert severity="error">{error}</Alert> : null}

      {!loading && details ? (
        <DetailCard>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5}>
            <Stack spacing={2} sx={{ width: { xs: '100%', lg: 240 }, alignItems: { xs: 'center', lg: 'stretch' } }}>
              <Box
                component="img"
                src={details.pet.image}
                alt={details.pet.name}
                sx={{
                  width: { xs: 112, lg: '100%' },
                  height: { xs: 112, lg: 220 },
                  borderRadius: 3,
                  objectFit: 'cover',
                  border: '1px solid',
                  borderColor: 'grey.200',
                }}
              />
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', justifyContent: { xs: 'center', lg: 'flex-start' } }}>
                {details.pet.colors.length > 0 ? (
                  details.pet.colors.map((color) => (
                    <Chip
                      key={`${details.pet.id}-${color}`}
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
            </Stack>

            <Stack spacing={2} sx={{ flex: 1 }}>
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {details.pet.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Pet profile from the Fur-Dentity mobile records.
                </Typography>
              </Box>

              <Stack spacing={1}>
                {petRows.map(([label, value]) => (
                  <DetailInfoRow key={label} label={label} value={value} />
                ))}
              </Stack>
            </Stack>
          </Stack>
        </DetailCard>
      ) : null}

      <ConfirmDeleteDialog
        open={confirmOpen}
        title="Delete pet record?"
        description={
          details ? `Delete ${details.pet.name}? This removes the pet record from the database.` : ''
        }
        confirmLabel="Delete pet"
        loading={deleting}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleDeletePet()}
      />
    </Stack>
  );
}
