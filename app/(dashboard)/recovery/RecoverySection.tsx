'use client';

import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { auth } from '@/lib/firebase';
import { DeleteOutlineIcon, RestoreFromTrashRoundedIcon, SearchIcon } from '@/components/icons';

type RecoveryModule = 'all' | 'admins' | 'users' | 'pets' | 'donation' | 'petShelterList' | 'adoptedPets' | 'reports';

type RecoveryRecord = {
  id: string;
  module: Exclude<RecoveryModule, 'all'>;
  moduleLabel: string;
  name: string;
  deletedAt: string;
  archivePath: string;
  restorePath: string;
  reportMainDir?: string;
  reportSubDir?: string;
};

type RecoveryResponse = {
  records?: RecoveryRecord[];
  error?: string;
};

const moduleOptions: Array<{ value: RecoveryModule; label: string }> = [
  { value: 'all', label: 'All Modules' },
  { value: 'admins', label: 'System Admins' },
  { value: 'users', label: 'Users' },
  { value: 'pets', label: 'Registered Pets' },
  { value: 'donation', label: 'Donation' },
  { value: 'petShelterList', label: 'Shelter Pets' },
  { value: 'adoptedPets', label: 'Adopted Pets' },
  { value: 'reports', label: 'Reports' },
];

const formatDateTime = (value: string) => {
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

export default function RecoverySection() {
  const [records, setRecords] = useState<RecoveryRecord[]>([]);
  const [moduleFilter, setModuleFilter] = useState<RecoveryModule>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<RecoveryRecord | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<RecoveryRecord | null>(null);

  const getAuthHeaders = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error('Your session expired. Please sign in again.');
    }

    const idToken = await currentUser.getIdToken();

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    };
  };

  const loadRecords = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');

      const headers = await getAuthHeaders();
      const response = await fetch('/api/recovery', { headers });
      const data = (await response.json().catch(() => null)) as RecoveryResponse | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to load recovery records.');
        return;
      }

      setRecords(data?.records ?? []);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load recovery records.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return records.filter((record) => {
      const moduleMatches = moduleFilter === 'all' || record.module === moduleFilter;
      const searchMatches =
        !normalizedSearch ||
        [record.name, record.moduleLabel, record.id, record.archivePath, record.restorePath].some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        );

      return moduleMatches && searchMatches;
    });
  }, [records, moduleFilter, search]);

  const paginatedRecords = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredRecords.slice(start, start + rowsPerPage);
  }, [filteredRecords, page, rowsPerPage]);

  const handleRestore = async () => {
    if (!restoreTarget) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch('/api/recovery/restore', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          module: restoreTarget.module,
          id: restoreTarget.id,
          reportMainDir: restoreTarget.reportMainDir,
          reportSubDir: restoreTarget.reportSubDir,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to restore record.');
        return;
      }

      setRecords((current) => current.filter((record) => record.archivePath !== restoreTarget.archivePath));
      setMessage(`${restoreTarget.name} was restored successfully.`);
      setRestoreTarget(null);
    } catch (restoreError) {
      console.error(restoreError);
      setError('Failed to restore record.');
    } finally {
      setSaving(false);
    }
  };

  const handleHardDelete = async () => {
    if (!hardDeleteTarget) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const headers = await getAuthHeaders();
      const response = await fetch('/api/recovery/hard-delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          module: hardDeleteTarget.module,
          id: hardDeleteTarget.id,
          reportMainDir: hardDeleteTarget.reportMainDir,
          reportSubDir: hardDeleteTarget.reportSubDir,
        }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to permanently delete record.');
        return;
      }

      setRecords((current) => current.filter((record) => record.archivePath !== hardDeleteTarget.archivePath));
      setMessage(`${hardDeleteTarget.name} was permanently deleted from recovery.`);
      setHardDeleteTarget(null);
    } catch (deleteError) {
      console.error(deleteError);
      setError('Failed to permanently delete record.');
    } finally {
      setSaving(false);
    }
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
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', lg: 'center' }}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Recovery
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Restore archived admin, user, pet, donation, adoption, and report records from the archive database.
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 170 } }}>
            <InputLabel>Module</InputLabel>
            <Select
              label="Module"
              value={moduleFilter}
              onChange={(event) => {
                setModuleFilter(event.target.value as RecoveryModule);
                setPage(0);
              }}
            >
              {moduleOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Search archived records"
            size="small"
            sx={{ minWidth: { xs: '100%', md: 290 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Stack>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}

      <TableContainer sx={{ borderRadius: 2.5, boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)', maxHeight: 560 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700, py: 1.25 }}>Record</TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700, py: 1.25 }}>Module</TableCell>
              <TableCell sx={{ bgcolor: 'background.paper', fontWeight: 700, py: 1.25 }}>Deleted At</TableCell>
              <TableCell align="right" sx={{ bgcolor: 'background.paper', fontWeight: 700, py: 1.25 }}>
                Action
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" py={5}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Loading archived records...
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : null}

            {!loading && paginatedRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Box py={5} textAlign="center">
                    <Typography variant="subtitle1" fontWeight={700}>
                      No archived records found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Deleted admin, user, pet, donation, adoption, and report records will appear here after they are archived.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : null}

            {!loading
              ? paginatedRecords.map((record) => (
                  <TableRow key={record.archivePath} hover>
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {record.name}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Chip size="small" label={record.moduleLabel} variant="outlined" sx={{ borderRadius: 2 }} />
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>{formatDateTime(record.deletedAt)}</TableCell>
                    <TableCell align="right" sx={{ py: 1.25 }}>
                      <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                        <Button
                          variant="contained"
                          size="small"
                          color="primary"
                          startIcon={<RestoreFromTrashRoundedIcon sx={{ fontSize: 18 }} />}
                          onClick={() => setRestoreTarget(record)}
                        >
                          Restore
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          startIcon={<DeleteOutlineIcon sx={{ fontSize: 18 }} />}
                          onClick={() => setHardDeleteTarget(record)}
                        >
                          Hard Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={filteredRecords.length}
        page={page}
        onPageChange={(_, nextPage) => setPage(nextPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(Number(event.target.value));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 25]}
        sx={{
          '.MuiTablePagination-toolbar': {
            minHeight: 44,
            px: 0.5,
          },
          '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
            fontSize: '0.8125rem',
          },
        }}
      />

      <ConfirmDeleteDialog
        open={!!restoreTarget}
        title="Restore archived record?"
        description={
          restoreTarget
            ? `${restoreTarget.name} will be restored and removed from recovery.`
            : ''
        }
        confirmLabel="Restore"
        confirmColor="primary"
        confirmIcon="check"
        loading={saving}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => void handleRestore()}
      />

      <ConfirmDeleteDialog
        open={!!hardDeleteTarget}
        title="Permanently delete record?"
        description={
          hardDeleteTarget
            ? `${hardDeleteTarget.name} will be permanently removed from recovery. This cannot be restored after deletion.`
            : ''
        }
        confirmLabel="Hard delete"
        confirmColor="error"
        confirmIcon="delete"
        loading={saving}
        onClose={() => setHardDeleteTarget(null)}
        onConfirm={() => void handleHardDelete()}
      />
    </Paper>
  );
}
