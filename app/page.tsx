'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, onAuthStateChanged, signInWithEmailAndPassword } from '@/lib/firebase';
import {
  TextField,
  Button,
  Box,
  Paper,
  Typography,
  Avatar,
  Alert,
  Collapse,
} from '@mui/material';
import { LoginRoundedIcon } from '@/components/icons';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        return;
      }

      const idToken = await user.getIdToken();
      const response = await fetch('/api/session/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      if (response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { mustChangePassword?: boolean }
          | null;
        router.replace(data?.mustChangePassword ? '/change-password' : '/dashboard');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const resetErrors = () => {
    setEmailError('');
    setPasswordError('');
    setFormError('');
    setFormSuccess('');
  };

  const validateLoginFields = () => {
    let valid = true;
    resetErrors();

    if (!email.trim()) {
      setEmailError('Email is required');
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Enter a valid email address');
      valid = false;
    }

    if (!password.trim()) {
      setPasswordError('Password is required');
      valid = false;
    }

    return valid;
  };

  const handleLogin = async () => {
    if (!validateLoginFields()) return;

    try {
      setLoading(true);
      setFormError('');
      setFormSuccess('');

      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken();
      const response = await fetch('/api/session/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setFormError(
          data?.error || 'Login succeeded, but the secure admin session could not be created.'
        );
        return;
      }

      const data = (await response.json().catch(() => null)) as
        | { mustChangePassword?: boolean }
        | null;

      setFormSuccess('Login successful. Redirecting...');
      router.push(data?.mustChangePassword ? '/change-password' : '/dashboard');
    } catch (err) {
      console.error(err);
      setPasswordError('Invalid email or password');
      setFormError('Login failed. Please check your credentials and try again.');
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
      '&.Mui-disabled fieldset': {
        borderColor: 'rgba(255,255,255,0.5)',
      },
    },
    '& .MuiOutlinedInput-input': {
      color: 'white',
    },
    '& .MuiOutlinedInput-input.Mui-disabled': {
      WebkitTextFillColor: 'white',
    },
    '& .MuiInputLabel-root': {
      color: 'rgba(255,255,255,0.7)',
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: 'white',
    },
    '& .MuiInputLabel-root.Mui-disabled': {
      color: 'rgba(255,255,255,0.7)',
    },
    '& .MuiFormHelperText-root': {
      color: '#ffb4b4',
      marginLeft: 0,
    },
    '& .MuiInputBase-root.Mui-disabled': {
      opacity: 1,
    },
  };

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundImage: 'url("/LoginBackground.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Paper
        sx={{
          p: 4,
          width: 320,
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
          mb={2}
          color="white"
          fontWeight="bold"
        >
          Admin Login
        </Typography>

        <Collapse in={!!formError}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        </Collapse>

        <Collapse in={!!formSuccess}>
          <Alert severity="success" sx={{ mb: 2 }}>
            {formSuccess}
          </Alert>
        </Collapse>

        <TextField
          label="Email"
          variant="outlined"
          size="small"
          fullWidth
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError('');
            if (formError) setFormError('');
          }}
          error={!!emailError}
          helperText={emailError}
          sx={whiteTextFieldSx}
        />

        <TextField
          label="Password"
          variant="outlined"
          margin="dense"
          size="small"
          type="password"
          fullWidth
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordError) setPasswordError('');
            if (formError) setFormError('');
          }}
          error={!!passwordError}
          helperText={passwordError}
          sx={whiteTextFieldSx}
        />

        <Button
          color="warning"
          variant="contained"
          fullWidth
          onClick={handleLogin}
          startIcon={loading ? undefined : <LoginRoundedIcon sx={{ fontSize: 18 }} />}
          sx={{ mt: 2, fontWeight: 'bold' }}
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </Paper>
    </Box>
  );
}
