'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { AdminRole } from '@/lib/auth/types';
import { auth } from '@/lib/firebase';
import { DeleteOutlineIcon } from '@/components/icons';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { DetailCard, DetailInfoRow, DetailPageHeader } from '@/components/DetailPageScaffold';

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

export default function UserDetailsPage({
  userId,
  adminRole,
}: {
  userId: string;
  adminRole: AdminRole;
}) {
  const router = useRouter();
  const [details, setDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canDelete = adminRole === 'super_admin';

  const loadUserDetails = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');

      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch(`/api/users/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as
        | (UserDetails & { error?: string })
        | null;

      if (!response.ok || !data?.user) {
        setError(data?.error || 'Failed to load user details.');
        return;
      }

      setDetails({
        user: data.user,
        pets: data.pets ?? [],
      });
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load user details.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadUserDetails();
  }, [userId]);

  const handleDeleteUser = async () => {
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
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to delete user.');
        return;
      }

      router.push('/users');
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to delete user.');
    } finally {
      setDeleting(false);
    }
  };

  const userRows = details
    ? [
        ['Email', details.user.email],
        ['Contact', details.user.contact],
        ['Address', details.user.address],
      ]
    : [];

  return (
    <Stack spacing={2.5}>
      <DetailPageHeader
        title="User Profile Information"
        description="Review this user's account details and the pets linked from the mobile app."
        backLabel="Back to users"
        onBack={() => router.push('/users')}
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
              Loading user details...
            </Typography>
          </Stack>
        </DetailCard>
      ) : null}

      {!loading && error ? <Alert severity="error">{error}</Alert> : null}

      {!loading && details ? (
        <>
          <DetailCard>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2.5}
              alignItems={{ xs: 'center', md: 'flex-start' }}
            >
              <Box
                component="img"
                src={details.user.profilePic}
                alt={details.user.name}
                sx={{
                  width: 112,
                  height: 112,
                  borderRadius: 3,
                  objectFit: 'cover',
                  border: '1px solid',
                  borderColor: 'grey.200',
                }}
              />

              <Stack spacing={1} sx={{ flex: 1, width: '100%' }}>
                <Typography variant="h6" fontWeight={700}>
                  {details.user.name}
                </Typography>
                {userRows.map(([label, value]) => (
                  <DetailInfoRow key={label} label={label} value={value} />
                ))}
              </Stack>
            </Stack>
          </DetailCard>

          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Registered Pets
            </Typography>

            {details.pets.length === 0 ? (
              <Alert severity="info">No pets found for this user.</Alert>
            ) : (
              <Stack spacing={1.25}>
                {details.pets.map((pet) => (
                  <Paper
                    key={pet.id}
                    elevation={0}
                    sx={{
                      p: 1.75,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: 'grey.200',
                    }}
                  >
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.75}>
                      <Box
                        component="img"
                        src={pet.image}
                        alt={pet.name}
                        sx={{
                          width: 84,
                          height: 84,
                          borderRadius: 2.5,
                          objectFit: 'cover',
                          border: '1px solid',
                          borderColor: 'grey.200',
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body1" fontWeight={700}>
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
                        <Stack direction="row" spacing={0.75} sx={{ mt: 1.25, flexWrap: 'wrap' }}>
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
        </>
      ) : null}

      <ConfirmDeleteDialog
        open={confirmOpen}
        title="Delete user record?"
        description={
          details ? `Delete ${details.user.name}? This removes the user record from the database.` : ''
        }
        confirmLabel="Delete user"
        loading={deleting}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleDeleteUser()}
      />
    </Stack>
  );
}
