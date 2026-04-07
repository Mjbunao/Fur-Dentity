'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  CircularProgress,
} from '@mui/material';
import {
  AdminPanelSettingsIcon,
  CloseRoundedIcon,
} from '@/components/icons';
import { auth } from '@/lib/firebase';

type CreateSystemAdminCardProps = {
  canManageAdmins: boolean;
  onCreated?: () => void;
};

export default function CreateSystemAdminDialog({
  canManageAdmins,
  onCreated,
}: CreateSystemAdminCardProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setTemporaryPassword('');
    resetMessages();
  };

  const handleClose = () => {
    if (loading) {
      return;
    }

    setOpen(false);
    resetForm();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManageAdmins) {
      setError('Only super admins can create system admin accounts.');
      return;
    }

    const currentUser = auth.currentUser;

    if (!currentUser) {
      setError('Your admin session expired. Please sign in again.');
      return;
    }

    try {
      setLoading(true);
      resetMessages();

      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/admins/system-admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
          name,
          email,
          temporaryPassword,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            admin?: {
              email: string;
            };
          }
        | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to create system admin account.');
        return;
      }

      setSuccess(
        `System admin account created for ${data?.admin?.email ?? email}. Ask them to sign in and change the temporary password.`
      );
      setName('');
      setEmail('');
      setTemporaryPassword('');
      onCreated?.();
      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 900);
    } catch (submitError) {
      console.error(submitError);
      setError('Something went wrong while creating the system admin account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <Button
          variant="contained"
          color="primary"
          size="small"
          onClick={() => setOpen(true)}
          disabled={!canManageAdmins}
          startIcon={<AdminPanelSettingsIcon sx={{ fontSize: 18 }} />}
          sx={{ px: 1.75, py: 0.75 }}
        >
          Create system admin
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        slotProps={{
          paper: {
            sx: {
              overflow: 'hidden',
              borderRadius: '12px',
              border: '1px solid',
              borderColor: 'rgba(0, 84, 255, 0.12)',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.14)',
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            px: { xs: 2.5, sm: 3 },
            pt: 2.5,
            pb: 1,
          }}
        >
          <DialogContentText sx={{ mt: 0.75, color: 'text.secondary' }}>
            Create a new system admin account with a temporary password. They will be asked to change it on first sign in.
          </DialogContentText>
        </DialogTitle>

        <DialogContent sx={{ px: { xs: 2.5, sm: 3 }, py: 3 }}>
          <form onSubmit={handleSubmit}>
            <Stack spacing={2.25}>
              <TextField
                label="Full name"
                placeholder="System admin name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                size="small"
                fullWidth
                disabled={loading || !canManageAdmins}
              />

              <TextField
                label="Email"
                placeholder="admin@example.com"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                size="small"
                fullWidth
                disabled={loading || !canManageAdmins}
              />

              <TextField
                label="Temporary password"
                placeholder="At least 6 characters"
                type="text"
                value={temporaryPassword}
                onChange={(event) => setTemporaryPassword(event.target.value)}
                size="small"
                fullWidth
                disabled={loading || !canManageAdmins}
                helperText="Share this with the new system admin."
              />

              {error ? <Alert severity="error">{error}</Alert> : null}
              {success ? <Alert severity="success">{success}</Alert> : null}

              <DialogActions sx={{ px: 0, pb: 0, pt: 0.5 }}>
                <Button
                  onClick={handleClose}
                  disabled={loading}
                  startIcon={<CloseRoundedIcon sx={{ fontSize: 18 }} />}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  variant="contained"
                  disabled={loading || !canManageAdmins}
                  startIcon={
                    loading ? <CircularProgress size={14} color="inherit" /> : <AdminPanelSettingsIcon sx={{ fontSize: 18 }} />
                  }
                  sx={{ minWidth: 190 }}
                >
                  {loading ? 'Creating account...' : 'Create system admin'}
                </Button>
              </DialogActions>
            </Stack>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
