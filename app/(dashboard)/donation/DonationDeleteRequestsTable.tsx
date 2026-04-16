'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
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
  TableSortLabel,
  Typography,
} from '@mui/material';
import type { DonationDeleteRequestRow } from './types';
import { DeleteOutlineIcon, DoNotDisturbOnRoundedIcon, VisibilityRoundedIcon } from '@/components/icons';

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
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

type SortKey = 'donationName' | 'requestedByName' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const headCells: Array<{ id: SortKey; label: string }> = [
  { id: 'donationName', label: 'Donation' },
  { id: 'requestedByName', label: 'Requested By' },
  { id: 'createdAt', label: 'Requested At' },
];

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
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const sortedRows = useMemo(() => {
    return [...rows].sort((left, right) => {
      const comparison =
        sortKey === 'createdAt'
          ? new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
          : String(left[sortKey]).localeCompare(String(right[sortKey]));

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [rows, sortKey, sortOrder]);

  const handleRequestSort = (property: SortKey) => {
    if (sortKey === property) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(property);
    setSortOrder(property === 'createdAt' ? 'desc' : 'asc');
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, md: 2 },
        borderRadius: 2.5,
        boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
      }}
    >
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="h6" fontWeight={700}>
          Donation Delete Requests
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Approve or reject system-admin requests to remove donation records.
        </Typography>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <TableContainer sx={{ borderRadius: 2.5, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {headCells.map((cell) => (
                <TableCell
                  key={cell.id}
                  sortDirection={sortKey === cell.id ? sortOrder : false}
                  sx={{ fontWeight: 700, py: 1.25 }}
                >
                  <TableSortLabel
                    active={sortKey === cell.id}
                    direction={sortKey === cell.id ? sortOrder : 'asc'}
                    onClick={() => handleRequestSort(cell.id)}
                  >
                    {cell.label}
                  </TableSortLabel>
                </TableCell>
              ))}
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
              ? sortedRows.map((row) => (
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
                          variant="outlined"
                          component={Link}
                          href={`/donation/${row.donationId}`}
                          startIcon={<VisibilityRoundedIcon fontSize="small" />}
                          sx={{ minWidth: 0, px: 1, py: 0.35, fontSize: '0.75rem' }}
                        >
                          View
                        </Button>
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
