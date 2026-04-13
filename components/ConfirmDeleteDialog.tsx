'use client';

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
} from '@mui/material';
import {
  CloseRoundedIcon,
  CheckCircleRoundedIcon,
  DeleteOutlineIcon,
  WarningAmberRoundedIcon,
} from '@/components/icons';

type ConfirmDeleteDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmColor?: 'primary' | 'success' | 'error' | 'warning';
  confirmIcon?: 'check' | 'close' | 'delete';
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  confirmColor = 'error',
  confirmIcon = 'delete',
  loading = false,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const ConfirmIcon =
    confirmIcon === 'check'
      ? CheckCircleRoundedIcon
      : confirmIcon === 'close'
        ? CloseRoundedIcon
        : DeleteOutlineIcon;

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <WarningAmberRoundedIcon color="warning" sx={{ fontSize: 22 }} />
          <span>{title}</span>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 1.5 }}>
        <DialogContentText color="text.secondary">{description}</DialogContentText>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0.5 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          startIcon={<CloseRoundedIcon sx={{ fontSize: 18 }} />}
        >
          Cancel
        </Button>
        <Button
          color={confirmColor}
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
          startIcon={<ConfirmIcon sx={{ fontSize: 18 }} />}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
