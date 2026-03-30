'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth, RecaptchaVerifier, signInWithPhoneNumber } from '@/lib/firebase';
import { ref, get, child } from 'firebase/database';
import {
  TextField,
  Button,
  Box,
  Paper,
  Typography,
  Avatar,
  Alert,
  Collapse,
  Stack,
} from '@mui/material';

type Admin = {
  id: string;
  email: string;
  password: string;
  contact: string;
};

const OTP_EXPIRY_SECONDS = 120;
const MAX_OTP_ATTEMPTS = 3;

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [foundAdmin, setFoundAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [otpAttemptsLeft, setOtpAttemptsLeft] = useState(MAX_OTP_ATTEMPTS);
  const [otpTimeLeft, setOtpTimeLeft] = useState(0);
  const [otpExpired, setOtpExpired] = useState(false);

  useEffect(() => {
    if (!showOtp || otpTimeLeft <= 0) {
      if (showOtp && otpTimeLeft <= 0) {
        setOtpExpired(true);
      }
      return;
    }

    const timer = setInterval(() => {
      setOtpTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setOtpExpired(true);
          setFormError('OTP expired. Please resend OTP.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showOtp, otpTimeLeft]);

  const setupRecaptcha = () => {
    if (typeof window !== 'undefined' && (window as any).recaptchaVerifier) {
      return (window as any).recaptchaVerifier;
    }

    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });

    if (typeof window !== 'undefined') {
      (window as any).recaptchaVerifier = verifier;
    }

    return verifier;
  };

  const resetErrors = () => {
    setEmailError('');
    setPasswordError('');
    setOtpError('');
    setFormError('');
    setFormSuccess('');
  };

  const resetOtpState = () => {
    setOtp('');
    setOtpError('');
    setConfirmationResult(null);
    setOtpAttemptsLeft(MAX_OTP_ATTEMPTS);
    setOtpTimeLeft(0);
    setOtpExpired(false);
  };

  const startOtpSession = (result: any) => {
    setConfirmationResult(result);
    setShowOtp(true);
    setOtp('');
    setOtpAttemptsLeft(MAX_OTP_ATTEMPTS);
    setOtpTimeLeft(OTP_EXPIRY_SECONDS);
    setOtpExpired(false);
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

  const findAdmin = async (): Promise<Admin | null> => {
    const dbRef = ref(db);
    const snapshot = await get(child(dbRef, 'web-admin'));

    let admin: Admin | null = null;

    snapshot.forEach((childSnap) => {
      const data = childSnap.val() as Partial<Admin>;

      if (
        typeof data.email === 'string' &&
        typeof data.password === 'string' &&
        typeof data.contact === 'string' &&
        data.email.toLowerCase() === email.toLowerCase() &&
        data.password === password
      ) {
        admin = {
          id: childSnap.key as string,
          email: data.email,
          password: data.password,
          contact: data.contact,
        };
      }
    });

    return admin;
  };

  const handleLogin = async () => {
    if (!validateLoginFields()) return;

    try {
      setLoading(true);
      setFormError('');
      setFormSuccess('');

      const admin = await findAdmin();

      if (!admin) {
        setEmailError(' ');
        setPasswordError('Invalid email or password');
        setFormError('Wrong credentials. Please try again.');
        return;
      }

      setFoundAdmin(admin);

      const verifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(auth, admin.contact, verifier);

      startOtpSession(result);
      setFormSuccess('OTP sent successfully.');
    } catch (err) {
      console.error(err);
      setFormError('Login failed. Please check your Firebase config and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!foundAdmin) {
      setFormError('Please log in again before resending OTP.');
      return;
    }

    try {
      setResending(true);
      setFormError('');
      setFormSuccess('');
      setOtpError('');

      const verifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(auth, foundAdmin.contact, verifier);

      startOtpSession(result);
      setFormSuccess('A new OTP has been sent.');
    } catch (err) {
      console.error(err);
      setFormError('Failed to resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const verifyOtp = async () => {
    setOtpError('');
    setFormError('');
    setFormSuccess('');

    if (!otp.trim()) {
      setOtpError('OTP is required');
      return;
    }

    if (!confirmationResult || !foundAdmin) {
      setFormError('Please request an OTP first.');
      return;
    }

    if (otpExpired || otpTimeLeft <= 0) {
      setOtpError('OTP has expired');
      setFormError('OTP expired. Please resend OTP.');
      return;
    }

    if (otpAttemptsLeft <= 0) {
      setOtpError('No attempts left');
      setFormError('You have used all 3 attempts. Please resend OTP.');
      return;
    }

    try {
      await confirmationResult.confirm(otp);

      sessionStorage.setItem('adminId', foundAdmin.id);
      sessionStorage.setItem('isLoggedIn', 'true');

      router.push('/about');
    } catch (err) {
      console.error(err);

      const nextAttempts = otpAttemptsLeft - 1;
      setOtpAttemptsLeft(nextAttempts);

      if (nextAttempts <= 0) {
        setOtpError('No attempts left');
        setFormError('You have used all 3 attempts. Please resend OTP.');
      } else {
        setOtpError(`Invalid OTP. ${nextAttempts} attempt(s) left.`);
        setFormError('OTP verification failed.');
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const disableVerifyButton =
    !otp.trim() || otpExpired || otpAttemptsLeft <= 0;

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
          disabled={showOtp}
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
          disabled={showOtp}
          sx={whiteTextFieldSx}
        />

        <Button
          color="warning"
          variant="contained"
          fullWidth
          onClick={handleLogin}
          sx={{ mt: 2, fontWeight: 'bold' }}
          disabled={loading || showOtp}
        >
          {loading ? 'Sending...' : showOtp ? 'OTP Sent' : 'Send OTP'}
        </Button>

        {showOtp && (
          <>
          <Stack direction="row" spacing={1} justifyContent="center" mt={2}>
             <Typography
              variant="body2"
              sx={{ mt: 2, color: 'white', textAlign: 'center' }}
            >
              Expires in: {formatTime(otpTimeLeft)}
            </Typography>

            <Typography
              variant="body2"
              sx={{ mt: 0.5, color: 'white', textAlign: 'center' }}
            >
              Attempts left: {otpAttemptsLeft}
            </Typography>
            </Stack>
            

            <TextField
              label="OTP"
              fullWidth
              margin="normal"
              size="small"
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value);
                if (otpError) setOtpError('');
                if (formError) setFormError('');
              }}
              error={!!otpError}
              helperText={otpError}
              sx={whiteTextFieldSx}
              disabled={otpExpired || otpAttemptsLeft <= 0}
            />

            <Stack direction="row" spacing={1}>
              <Button
                color="warning"
                variant="contained"
                fullWidth
                onClick={verifyOtp}
                sx={{ mt: 1, fontWeight: 'bold' }}
                disabled={disableVerifyButton}
              >
                Verify OTP
              </Button>

              <Button
                color="inherit"
                variant="outlined"
                fullWidth
                onClick={handleResendOtp}
                sx={{
                  mt: 1,
                  fontWeight: 'bold',
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.5)',
                  '&:hover': {
                    borderColor: 'white',
                  },
                }}
                disabled={resending}
              >
                {resending ? 'Resending...' : 'Resend'}
              </Button>
            </Stack>
          </>
        )}

        <div id="recaptcha-container"></div>
      </Paper>
    </Box>
  );
}