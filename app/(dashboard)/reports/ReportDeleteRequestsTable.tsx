'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import type { ReportDeleteRequestRow, ReportStatus } from './types';

type SortKey = 'petName' | 'reportStatus' | 'requestedByName' | 'createdAt';
type SortOrder = 'asc' | 'desc';

const headCells: Array<{ id: SortKey; label: string }> = [
  { id: 'petName', label: 'Report' },
  { id: 'reportStatus', label: 'Status' },
  { id: 'requestedByName', label: 'Requested By' },
  { id: 'createdAt', label: 'Requested At' },
];

const compactButtonSx = {
  minWidth: 0,
  px: 0.75,
  py: 0.25,
  fontSize: '0.7rem',
  whiteSpace: 'nowrap',
};

const ellipsisSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const toTitleCase = (value: string) =>
  value
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');

const statusColor = (status: ReportStatus) => {
  if (status === 'Finished') {
    return 'success';
  }

  if (status === 'Rejected') {
    return 'error';
  }

  if (status === 'Processing') {
    return 'primary';
  }

  if (status === 'Received') {
    return 'info';
  }

  return 'warning';
};

export default function ReportDeleteRequestsTable({
  rows,
  loading,
  error,
  onApprove,
  onReject,
}: {
  rows: ReportDeleteRequestRow[];
  loading: boolean;
  error: string;
  onApprove: (request: ReportDeleteRequestRow) => void;
  onReject: (request: ReportDeleteRequestRow) => void;
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
          Report Delete Requests
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          Review pending report delete requests submitted by system admins.
        </Typography>
      </Box>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <TableContainer sx={{ borderRadius: 2.5, border: '1px solid', borderColor: 'grey.200' }}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              {headCells.map((cell) => (
                <TableCell
                  key={cell.id}
                  sortDirection={sortKey === cell.id ? sortOrder : false}
                  sx={{
                    fontWeight: 700,
                    py: 1.25,
                    width:
                      cell.id === 'petName'
                        ? '20%'
                        : cell.id === 'reportStatus'
                          ? '16%'
                        : cell.id === 'requestedByName'
                          ? '22%'
                          : '20%',
                  }}
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
              <TableCell sx={{ fontWeight: 700, py: 1.25, width: 250 }}>Actions</TableCell>
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
                      Report delete requests from system admins will appear here.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : null}

            {!loading
              ? sortedRows.map((row) => (
                  <TableRow hover key={row.id}>
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography variant="body2" fontWeight={700} sx={ellipsisSx}>
                        {row.petName}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', ...ellipsisSx }}
                      >
                        {toTitleCase(row.reportType)} Pet / {toTitleCase(row.subDir || 'Unknown')}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Chip
                        size="small"
                        label={row.reportStatus}
                        color={statusColor(row.reportStatus)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography variant="body2" sx={ellipsisSx}>{row.requestedByName}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ...ellipsisSx }}>
                        {row.requestedByEmail}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography variant="body2" sx={ellipsisSx}>
                        {row.createdAt}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.25, width: 250 }}>
                      <Stack direction="row" spacing={0.5} flexWrap="nowrap" alignItems="center">
                        <Button
                          size="small"
                          variant="outlined"
                          component={Link}
                          href={`/reports/${row.reportKey}`}
                          startIcon={<VisibilityRoundedIcon fontSize="small" />}
                          sx={compactButtonSx}
                        >
                          View
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          startIcon={<DeleteOutlineIcon fontSize="small" />}
                          sx={compactButtonSx}
                          onClick={() => onApprove(row)}
                        >
                          Delete
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<DoNotDisturbOnRoundedIcon fontSize="small" />}
                          sx={compactButtonSx}
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
