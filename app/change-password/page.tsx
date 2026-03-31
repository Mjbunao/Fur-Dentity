import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth/session';
import ChangePasswordForm from './ChangePasswordForm';
import {
  Box,
  Paper,
  Typography,
  Avatar,
} from '@mui/material';

export default async function ChangePasswordPage() {
  const session = await requireSession();

  if (!session.mustChangePassword) {
    redirect('/dashboard');
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        px: 3,
        py: 4,
        backgroundImage: 'url("/LoginBackground.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Paper
        sx={{
          p: 4,
          width: 360,
          borderRadius: 3,
          boxShadow: 3,
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '2px solid rgba(255,255,255,0.3)',
        }}
      >
        <Avatar
          alt="SPN Logo"
          src="/spn-logo.png"
          sx={{ mx: 'auto', mb: 2, mt: 0, width: 70, height: 70, boxShadow: 1 }}
        />

        <Typography
          variant="h5"
          textAlign="center"
          mb={1}
          color="white"
          fontWeight="bold"
        >
          Change Password
        </Typography>

        <Typography
          variant="body2"
          textAlign="center"
          mb={3}
          color="rgba(255,255,255,0.82)"
        >
          This account is using a temporary password. Set a new one before continuing.
        </Typography>

        <ChangePasswordForm />
      </Paper>
    </Box>
  );
}
