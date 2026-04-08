'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  CircularProgress,
} from '@mui/material';
import type { AdminRole } from '@/lib/auth/types';
import { auth } from '@/lib/firebase';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import {
  ArrowBackRoundedIcon,
  DeleteOutlineIcon,
} from '@/components/icons';

type DonationDetails = {
  donation: {
    id: string;
    donorType: string;
    userId: string;
    name: string;
    email: string;
    contact: string;
    address: string;
    amount: number;
    date: string;
    platform: string;
    reference: string;
  };
};

export default function DonationDetailsPage({
  donationId,
  adminRole,
}: {
  donationId: string;
  adminRole: AdminRole;
}) {
  const router = useRouter();
  const [details, setDetails] = useState<DonationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canDelete = adminRole === 'super_admin';

  const loadDonationDetails = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');

      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch(`/api/donations/${donationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as
        | (DonationDetails & { error?: string })
        | null;

      if (!response.ok || !data?.donation) {
        setError(data?.error || 'Failed to load donation details.');
        return;
      }

      setDetails(data);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load donation details.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadDonationDetails();
  }, [donationId]);

  const handleDeleteDonation = async () => {
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
      const response = await fetch(`/api/donations/${donationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to delete donation.');
        return;
      }

      router.push('/donation');
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to delete donation.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
        spacing={1.5}
      >
        <Box>
          <Button
            variant="text"
            onClick={() => router.push('/donation')}
            startIcon={<ArrowBackRoundedIcon fontSize="small" />}
            sx={{ mb: 1.5, px: 0.5 }}
          >
            Back to donations
          </Button>

          <Typography variant="h5" fontWeight={700}>
            Donation Information
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Review donor, payment, and reference details for this donation record.
          </Typography>
        </Box>

        {canDelete ? (
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
        ) : null}
      </Stack>

      {loading ? (
        <Paper
          elevation={0}
          sx={{ p: 4, borderRadius: 4, border: '1px solid', borderColor: 'grey.200' }}
        >
          <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Loading donation details...
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      {!loading && error ? <Alert severity="error">{error}</Alert> : null}

      {!loading && details ? (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'grey.200',
          }}
        >
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {details.donation.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Donation record from the Fur-Dentity web admin panel.
              </Typography>
            </Box>

            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Donor Type: {details.donation.donorType}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Email: {details.donation.email}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Contact: {details.donation.contact}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Address: {details.donation.address}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Date: {details.donation.date}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Amount: PHP {details.donation.amount.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Platform: {details.donation.platform}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Reference No.: {details.donation.reference}
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      <ConfirmDeleteDialog
        open={confirmOpen}
        title="Delete donation record?"
        description={
          details
            ? `Delete ${details.donation.name}'s donation? This permanently removes the record from the database.`
            : ''
        }
        confirmLabel="Delete donation"
        loading={deleting}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleDeleteDonation()}
      />
    </Stack>
  );
}
