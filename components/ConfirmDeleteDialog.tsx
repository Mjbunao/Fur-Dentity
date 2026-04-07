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
  DeleteOutlineIcon,
  WarningAmberRoundedIcon,
} from '@/components/icons';

type ConfirmDeleteDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  loading = false,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
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
          color="error"
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
          startIcon={<DeleteOutlineIcon sx={{ fontSize: 18 }} />}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
