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
import { DeleteOutlineIcon, DoNotDisturbOnRoundedIcon, VisibilityRoundedIcon } from '@/components/icons';
import type { AdoptionDeleteRequestRow } from './types';

type SortKey = 'petName' | 'requestedByName' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const headCells: Array<{ id: SortKey; label: string }> = [
  { id: 'petName', label: 'Pet' },
  { id: 'requestedByName', label: 'Requested By' },
  { id: 'createdAt', label: 'Requested At' },
];

export default function AdoptionDeleteRequestsTable({
  rows,
  loading,
  error,
  onApprove,
  onReject,
}: {
  rows: AdoptionDeleteRequestRow[];
  loading: boolean;
  error: string;
  onApprove: (request: AdoptionDeleteRequestRow) => void;
  onReject: (request: AdoptionDeleteRequestRow) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const sortedRows = useMemo(() => {
    return [...rows].sort((left, right) => {
      const comparison = String(left[sortKey]).localeCompare(String(right[sortKey]));
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
        p: { xs: 2, md: 2.5 },
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'grey.200',
      }}
    >
      <Box sx={{ mb: 2.25 }}>
        <Typography variant="h6" fontWeight={700}>
          Adoption Delete Requests
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          Review pending adoption delete requests submitted by system admins.
        </Typography>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <TableContainer sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'grey.200' }}>
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
                      Adoption delete requests from system admins will appear here.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : null}

            {!loading
              ? sortedRows.map((row) => (
                  <TableRow hover key={row.id}>
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {row.petName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                        {row.petStatus}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography variant="body2">{row.requestedByName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.requestedByEmail}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>{row.createdAt}</TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Stack direction="row" spacing={0.75}>
                        <Button
                          size="small"
                          variant="outlined"
                          component={Link}
                          href={`/adoption/${row.petId}?status=${row.petStatus}`}
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
