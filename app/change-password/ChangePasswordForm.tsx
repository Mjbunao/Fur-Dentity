'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { updatePassword } from 'firebase/auth';
import {
  TextField,
  Button,
  Alert,
  Collapse,
  Stack,
} from '@mui/material';
import { SaveRoundedIcon } from '@/components/icons';

export default function ChangePasswordForm() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const currentUser = auth.currentUser;

    if (!currentUser) {
      setError('Your session expired. Please sign in again.');
      return;
    }

    try {
      setLoading(true);

      await updatePassword(currentUser, newPassword);

      const idToken = await currentUser.getIdToken(true);
      const response = await fetch('/api/admins/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Password updated, but the profile flag could not be cleared.');
        return;
      }

      setSuccess('Password updated successfully. Redirecting to dashboard...');
      setTimeout(() => {
        router.replace('/dashboard');
      }, 900);
    } catch (submitError) {
      console.error(submitError);
      setError(
        'Could not update the password. If this session is no longer recent enough, sign in again with the temporary password and retry.'
      );
    } finally {
      setLoading(false);
    }
  };

  const whiteTextFieldSx = {
    '& .MuiOutlinedInput-root': {
      color: 'white',
      '& fieldset': {
        borderColor: 'rgba(255,255,255,0.5)',
      },
      '&:hover fieldset': {
        borderColor: 'white',
      },
      '&.Mui-focused fieldset': {
        borderColor: 'white',
      },
    },
    '& .MuiOutlinedInput-input': {
      color: 'white',
    },
    '& .MuiInputLabel-root': {
      color: 'rgba(255,255,255,0.7)',
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: 'white',
    },
    '& .MuiFormHelperText-root': {
      color: '#ffb4b4',
      marginLeft: 0,
    },
  };

  return (
    <form onSubmit={handleSubmit}>
      <Collapse in={!!error}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      </Collapse>

      <Collapse in={!!success}>
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      </Collapse>

      <Stack spacing={2}>
        <TextField
          label="New Password"
          variant="outlined"
          size="small"
          fullWidth
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          sx={whiteTextFieldSx}
          disabled={loading}
          helperText="At least 6 characters"
        />

        <TextField
          label="Confirm New Password"
          variant="outlined"
          size="small"
          fullWidth
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          sx={whiteTextFieldSx}
          disabled={loading}
        />

        <Button
          type="submit"
          color="warning"
          variant="contained"
          fullWidth
          startIcon={loading ? undefined : <SaveRoundedIcon sx={{ fontSize: 18 }} />}
          sx={{ mt: 1, fontWeight: 'bold' }}
          disabled={loading}
        >
          {loading ? 'Updating password...' : 'Update password'}
        </Button>
      </Stack>
    </form>
  );
}
