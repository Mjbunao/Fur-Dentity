'use client';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { DonationDeleteRequestRow } from './types';
import { DeleteOutlineIcon, DoNotDisturbOnRoundedIcon } from '@/components/icons';

const formatRequestedAt = (value: string) => {
  if (!value) {
    return 'Unknown';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export default function DonationDeleteRequestsTable({
  rows,
  loading,
  error,
  onApprove,
  onReject,
}: {
  rows: DonationDeleteRequestRow[];
  loading: boolean;
  error: string;
  onApprove: (request: DonationDeleteRequestRow) => void;
  onReject: (request: DonationDeleteRequestRow) => void;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'grey.200',
      }}
    >
      <Box sx={{ mb: 2.25 }}>
        <Typography variant="h6" fontWeight={700}>
          Donation Delete Requests
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          Review pending delete requests submitted by system admins before removing donation records.
        </Typography>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <TableContainer sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'grey.200' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, py: 1.25 }}>Donation</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.25 }}>Requested By</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.25 }}>Requested At</TableCell>
              <TableCell sx={{ fontWeight: 700, py: 1.25 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" py={5}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Loading delete requests...
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : null}

            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Box py={5} textAlign="center">
                    <Typography variant="subtitle1" fontWeight={700}>
                      No pending requests
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Delete requests from system admins will appear here.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : null}

            {!loading
              ? rows.map((row) => (
                  <TableRow hover key={row.id}>
                    <TableCell sx={{ py: 1.25 }}>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" fontWeight={700}>
                          {row.donationName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Request ID: {row.id}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography variant="body2">{row.requestedByName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.requestedByEmail}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>{formatRequestedAt(row.createdAt)}</TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Stack direction="row" spacing={0.75}>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={<DeleteOutlineIcon fontSize="small" />}
                          sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
                          onClick={() => onApprove(row)}
                        >
                          Delete
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DoNotDisturbOnRoundedIcon fontSize="small" />}
                          sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
                          onClick={() => onReject(row)}
                        >
                          Reject
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
