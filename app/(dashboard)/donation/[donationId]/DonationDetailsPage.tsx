'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Stack,
  Typography,
  CircularProgress,
} from '@mui/material';
import type { AdminRole } from '@/lib/auth/types';
import { auth } from '@/lib/firebase';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { DetailCard, DetailInfoRow, DetailPageHeader } from '@/components/DetailPageScaffold';
import {
  CloseRoundedIcon,
  DeleteOutlineIcon,
  EditRoundedIcon,
  RequestPageRoundedIcon,
} from '@/components/icons';
import DonationFormDialog, { type DonationFormPayload } from '../DonationFormDialog';
import type { DonationRow, DonationUserOption } from '../types';

type DonationDetails = {
  donation: {
    id: string;
    donorType: 'Registered User' | 'Unregistered User';
    userId: string;
    name: string;
    email: string;
    contact: string;
    address: string;
    amount: number;
    date: string;
    platform: string;
    reference: string;
    createdAt: string;
    requestStatus?: 'pending' | 'approved' | 'rejected' | null;
  };
};

export default function DonationDetailsPage({
  donationId,
  adminRole,
  adminUid,
  adminName,
  adminEmail,
}: {
  donationId: string;
  adminRole: AdminRole;
  adminUid: string;
  adminName?: string;
  adminEmail: string;
}) {
  const router = useRouter();
  const [details, setDetails] = useState<DonationDetails | null>(null);
  const [users, setUsers] = useState<DonationUserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

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
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      };
      const [response, metaResponse] = await Promise.all([
        fetch(`/api/donations/${donationId}`, {
          method: 'GET',
          headers,
        }),
        fetch('/api/donations/meta', {
          method: 'GET',
          headers,
        }),
      ]);

      const data = (await response.json().catch(() => null)) as
        | (DonationDetails & { error?: string })
        | null;
      const metaData = (await metaResponse.json().catch(() => null)) as
        | { users?: DonationUserOption[]; error?: string }
        | null;

      if (!response.ok || !data?.donation) {
        setError(data?.error || 'Failed to load donation details.');
        return;
      }

      if (metaResponse.ok) {
        setUsers(metaData?.users ?? []);
      }

      setDetails(data);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load donation details.');
    } finally {
      setLoading(false);
    }
  });

  const selectedDonation: DonationRow | null = details
    ? {
        ...details.donation,
        createdAt: details.donation.createdAt || '',
      }
    : null;

  const handleSubmitDonation = async (payload: DonationFormPayload) => {
    try {
      setDeleting(true);
      setError('');
      setMessage('');

      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch(`/api/donations/${donationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as
        | { donation?: DonationDetails['donation']; error?: string }
        | null;

      if (!response.ok || !data?.donation) {
        setError(data?.error || 'Failed to update donation.');
        return;
      }

      setDetails({ donation: data.donation });
      setMessage('Donation updated successfully.');
      setEditOpen(false);
    } catch (submitError) {
      console.error(submitError);
      setError('Failed to update donation.');
    } finally {
      setDeleting(false);
    }
  };

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

  const requestDeleteDonation = async () => {
    if (!details) {
      return;
    }

    try {
      setDeleting(true);
      setError('');
      setMessage('');

      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/donations/delete-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          donationId,
          donationName: details.donation.name,
          requestedByUid: adminUid,
          requestedByName: adminName || 'System Admin',
          requestedByEmail: adminEmail,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to submit delete request.');
        return;
      }

      setDetails((current) =>
        current ? { donation: { ...current.donation, requestStatus: 'pending' } } : current
      );
      setMessage(`Delete request submitted for ${details.donation.name}.`);
      setRequestOpen(false);
    } catch (requestError) {
      console.error(requestError);
      setError('Failed to submit delete request.');
    } finally {
      setDeleting(false);
    }
  };

  const cancelDeleteRequest = async () => {
    if (!details) {
      return;
    }

    try {
      setDeleting(true);
      setError('');
      setMessage('');

      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/donations/delete-requests', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ donationId }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to cancel delete request.');
        return;
      }

      setDetails((current) =>
        current ? { donation: { ...current.donation, requestStatus: null } } : current
      );
      setMessage(`Delete request canceled for ${details.donation.name}.`);
      setCancelOpen(false);
    } catch (cancelError) {
      console.error(cancelError);
      setError('Failed to cancel delete request.');
    } finally {
      setDeleting(false);
    }
  };

  const donationRows = details
    ? [
        ['Donor Type', details.donation.donorType],
        ['Email', details.donation.email],
        ['Contact', details.donation.contact],
        ['Address', details.donation.address],
        ['Date', details.donation.date],
        ['Amount', `PHP ${details.donation.amount.toLocaleString()}`],
        ['Platform', details.donation.platform],
        ['Reference No.', details.donation.reference],
      ]
    : [];

  return (
    <Stack spacing={2.5}>
      <DetailPageHeader
        title="Donation Information"
        description="Review donor, payment, and reference details for this donation record."
        backLabel="Back to donations"
        onBack={() => router.push('/donation')}
        action={
          details ? (
            <Stack direction="row" spacing={0.75} flexWrap="wrap">
              <Button
                color="warning"
                variant="outlined"
                size="small"
                startIcon={<EditRoundedIcon fontSize="small" />}
                onClick={() => setEditOpen(true)}
                disabled={deleting || loading}
                sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
              >
                Edit
              </Button>
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
              ) : (
                <Button
                  color="error"
                  variant="outlined"
                  size="small"
                  startIcon={
                    details.donation.requestStatus === 'pending' ? (
                      <CloseRoundedIcon fontSize="small" />
                    ) : (
                      <RequestPageRoundedIcon fontSize="small" />
                    )
                  }
                  onClick={() =>
                    details.donation.requestStatus === 'pending'
                      ? setCancelOpen(true)
                      : setRequestOpen(true)
                  }
                  disabled={deleting || loading}
                  sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
                >
                  {details.donation.requestStatus === 'pending' ? 'Cancel Request' : 'Request Delete'}
                </Button>
              )}
            </Stack>
          ) : null
        }
      />

      {loading ? (
        <DetailCard>
          <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Loading donation details...
            </Typography>
          </Stack>
        </DetailCard>
      ) : null}

      {!loading && error ? <Alert severity="error">{error}</Alert> : null}
      {!loading && message ? <Alert severity="success">{message}</Alert> : null}

      {!loading && details ? (
        <DetailCard>
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
              {donationRows.map(([label, value]) => (
                <DetailInfoRow key={label} label={label} value={value} />
              ))}
            </Stack>
          </Stack>
        </DetailCard>
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

      <ConfirmDeleteDialog
        open={requestOpen}
        title="Request donation deletion?"
        description={
          details
            ? `Send a delete request for ${details.donation.name}'s donation? A super admin will review it before removal.`
            : ''
        }
        confirmLabel="Send request"
        loading={deleting}
        onClose={() => setRequestOpen(false)}
        onConfirm={() => void requestDeleteDonation()}
      />

      <ConfirmDeleteDialog
        open={cancelOpen}
        title="Cancel delete request?"
        description={details ? `Cancel the pending delete request for ${details.donation.name}'s donation?` : ''}
        confirmLabel="Cancel request"
        confirmColor="warning"
        confirmIcon="close"
        loading={deleting}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => void cancelDeleteRequest()}
      />

      <DonationFormDialog
        key={`${details?.donation.id ?? 'donation'}-${editOpen ? 'open' : 'closed'}`}
        open={editOpen}
        mode="edit"
        donation={selectedDonation}
        users={users}
        loading={deleting}
        onClose={() => setEditOpen(false)}
        onSubmit={handleSubmitDonation}
      />
    </Stack>
  );
}
