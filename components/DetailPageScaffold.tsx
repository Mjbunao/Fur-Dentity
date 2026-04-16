import type { ReactNode } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { ArrowBackRoundedIcon } from '@/components/icons';

export function DetailPageHeader({
  title,
  description,
  backLabel,
  onBack,
  action,
}: {
  title: string;
  description: string;
  backLabel: string;
  onBack: () => void;
  action?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
      spacing={1.5}
    >
      <Box>
        <Button
          variant="text"
          onClick={onBack}
          startIcon={<ArrowBackRoundedIcon fontSize="small" />}
          sx={{ mb: 1, px: 0.5 }}
        >
          {backLabel}
        </Button>

        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {description}
        </Typography>
      </Box>

      {action}
    </Stack>
  );
}

export function DetailCard({ children }: { children: ReactNode }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, md: 2 },
        borderRadius: 2.5,
        boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
      }}
    >
      {children}
    </Paper>
  );
}

export function DetailInfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={0.75}
      justifyContent="space-between"
      sx={{
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: 'grey.100',
      }}
    >
      <Typography variant="body2" fontWeight={700}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign={{ xs: 'left', sm: 'right' }}>
        {value}
      </Typography>
    </Stack>
  );
}
