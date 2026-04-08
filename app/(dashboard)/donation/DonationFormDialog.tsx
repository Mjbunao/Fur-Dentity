'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import type { DonationRow, DonationUserOption } from './types';
import {
  AddRoundedIcon,
  CloseRoundedIcon,
  PaymentsRoundedIcon,
  SaveRoundedIcon,
} from '@/components/icons';

export type DonationFormPayload = {
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
};

type DonationFormDialogProps = {
  open: boolean;
  mode: 'create' | 'edit';
  donation: DonationRow | null;
  users: DonationUserOption[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: DonationFormPayload) => Promise<void> | void;
};

const defaultForm = (): DonationFormPayload => ({
  donorType: 'Registered User',
  userId: '',
  name: '',
  email: '',
  contact: '',
  address: '',
  amount: 0,
  date: '',
  platform: '',
  reference: '',
});

export default function DonationFormDialog({
  open,
  mode,
  donation,
  users,
  loading = false,
  onClose,
  onSubmit,
}: DonationFormDialogProps) {
  const initialForm = useMemo<DonationFormPayload>(() => {
    if (mode === 'edit' && donation) {
      return {
        donorType: donation.donorType,
        userId: donation.userId || '',
        name: donation.name,
        email: donation.email,
        contact: donation.contact,
        address: donation.address,
        amount: donation.amount,
        date: donation.date,
        platform: donation.platform,
        reference: donation.reference,
      };
    }

    return defaultForm();
  }, [mode, donation]);

  const [form, setForm] = useState<DonationFormPayload>(initialForm);
  const [error, setError] = useState('');

  const handleChange = <K extends keyof DonationFormPayload>(key: K, value: DonationFormPayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!form.date || !form.platform || !form.reference.trim()) {
      setError('Date, platform, and reference number are required.');
      return;
    }

    if (form.amount <= 0) {
      setError('Donation amount must be greater than zero.');
      return;
    }

    if (form.donorType === 'Registered User' && !form.userId) {
      setError('Please select a registered user.');
      return;
    }

    if (!form.name.trim() || !form.email.trim() || !form.contact.trim() || !form.address.trim()) {
      setError('Please complete all donor details.');
      return;
    }

    await onSubmit({
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      contact: form.contact.trim(),
      address: form.address.trim(),
      reference: form.reference.trim(),
    });
  };

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1 }}>
        {mode === 'create' ? 'Create Donation' : 'Edit Donation'}
        <DialogContentText sx={{ mt: 0.75, color: 'text.secondary' }}>
          {mode === 'create'
            ? 'Add a donation entry from a registered user or a manual donor record.'
            : 'Update the donation information and keep the donor details accurate.'}
        </DialogContentText>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        <form onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel id="donor-type-label">Donor type</InputLabel>
              <Select
                labelId="donor-type-label"
                label="Donor type"
                value={form.donorType}
                onChange={(event) => {
                  const donorType = event.target.value as DonationFormPayload['donorType'];
                  setForm((current) => ({
                    ...current,
                    donorType,
                    userId: donorType === 'Registered User' ? current.userId : '',
                    name: donorType === 'Registered User' ? current.name : '',
                    email: donorType === 'Registered User' ? current.email : '',
                    contact: donorType === 'Registered User' ? current.contact : '',
                    address: donorType === 'Registered User' ? current.address : '',
                  }));
                }}
                disabled={loading}
              >
                <MenuItem value="Registered User">Registered User</MenuItem>
                <MenuItem value="Unregistered User">Manual Entry</MenuItem>
              </Select>
            </FormControl>

            {form.donorType === 'Registered User' ? (
              <FormControl size="small" fullWidth>
                <InputLabel id="registered-user-label">Select user</InputLabel>
                <Select
                  labelId="registered-user-label"
                  label="Select user"
                  value={form.userId}
                  onChange={(event) => {
                    const userId = event.target.value;
                    const user = users.find((entry) => entry.id === userId) ?? null;

                    setForm((current) => ({
                      ...current,
                      userId,
                      name: user?.name || current.name,
                      email: user?.email || current.email,
                      contact: user?.contact || current.contact,
                      address: user?.address || current.address,
                    }));
                  }}
                  disabled={loading}
                >
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}

            <TextField label="Full name" size="small" fullWidth value={form.name} onChange={(event) => handleChange('name', event.target.value)} disabled={loading || form.donorType === 'Registered User'} />
            <TextField label="Email" size="small" fullWidth type="email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} disabled={loading || form.donorType === 'Registered User'} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Contact number" size="small" fullWidth value={form.contact} onChange={(event) => handleChange('contact', event.target.value)} disabled={loading || form.donorType === 'Registered User'} />
              <TextField label="Date" size="small" fullWidth type="date" value={form.date} onChange={(event) => handleChange('date', event.target.value)} disabled={loading} slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>

            <TextField label="Address" size="small" fullWidth value={form.address} onChange={(event) => handleChange('address', event.target.value)} disabled={loading || form.donorType === 'Registered User'} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel id="platform-label">Platform</InputLabel>
                <Select labelId="platform-label" label="Platform" value={form.platform} onChange={(event) => handleChange('platform', event.target.value)} disabled={loading}>
                  <MenuItem value="Gcash">Gcash</MenuItem>
                  <MenuItem value="Paymaya">Paymaya</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
              <TextField label="Reference No." size="small" fullWidth value={form.reference} onChange={(event) => handleChange('reference', event.target.value)} disabled={loading} />
            </Stack>

            <TextField
              label="Amount"
              size="small"
              fullWidth
              type="number"
              value={form.amount || ''}
              onChange={(event) => handleChange('amount', Number(event.target.value))}
              disabled={loading}
              slotProps={{
                input: {
                  startAdornment: <PaymentsRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 1 }} />,
                },
              }}
            />

            {error ? <Alert severity="error">{error}</Alert> : null}

            <DialogActions sx={{ px: 0, pb: 0, pt: 0.5 }}>
              <Button onClick={onClose} disabled={loading} startIcon={<CloseRoundedIcon sx={{ fontSize: 18 }} />}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={mode === 'create' ? <AddRoundedIcon sx={{ fontSize: 18 }} /> : <SaveRoundedIcon sx={{ fontSize: 18 }} />}
              >
                {mode === 'create' ? 'Save donation' : 'Update donation'}
              </Button>
            </DialogActions>
          </Stack>
        </form>
      </DialogContent>
    </Dialog>
  );
}
