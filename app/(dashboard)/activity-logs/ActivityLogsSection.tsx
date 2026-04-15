'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import {
  Alert,
  Box,
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
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import { auth } from '@/lib/firebase';
import { SearchIcon } from '@/components/icons';

type ActivityLogRow = {
  id: string;
  actor: {
    name: string;
    email: string;
    role: 'super_admin' | 'system_admin' | string;
  };
  action: string;
  module: string;
  subject?: {
    type?: string;
    id?: string;
    name?: string;
  };
  target: {
    type: string;
    id: string;
    name: string;
  };
  description: string;
  createdAt: string;
};

type RoleFilter = 'all' | 'super_admin' | 'system_admin';
type SortOrder = 'asc' | 'desc';

const headCells: Array<{ id: 'description' | 'actor' | 'role' | 'createdAt'; label: string; width: string; sortable?: boolean }> = [
  { id: 'description', label: 'Activity', width: '44%' },
  { id: 'actor', label: 'Admin', width: '24%' },
  { id: 'role', label: 'Role', width: '12%' },
  { id: 'createdAt', label: 'Date & Time', width: '20%', sortable: true },
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

const formatRole = (role: string) => role.replace('_', ' ');

const ellipsisSx = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const tableContainerSx = {
  borderRadius: 2.5,
  border: '1px solid',
  borderColor: 'grey.200',
  maxHeight: 560,
};

export default function ActivityLogsSection() {
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const loadLogs = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');

      const headers = await getAuthHeaders();
      const response = await fetch('/api/activity-logs', { headers });
      const data = (await response.json().catch(() => null)) as
        | { logs?: ActivityLogRow[]; error?: string }
        | null;

      if (!response.ok) {
        setError(data?.error || 'Failed to load activity logs.');
        return;
      }

      setLogs(data?.logs ?? []);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load activity logs.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = logs.filter((log) => {
      const roleMatches = roleFilter === 'all' || log.actor.role === roleFilter;
      const searchMatches =
        !normalizedSearch ||
        [
          log.actor.name,
          log.actor.email,
          log.actor.role,
          log.action,
          log.module,
          log.subject?.name || '',
          log.target.name,
          log.description,
        ].some((value) => value.toLowerCase().includes(normalizedSearch));

      return roleMatches && searchMatches;
    });

    return [...filtered].sort((left, right) => {
      const comparison = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [logs, roleFilter, search, sortOrder]);

  const paginatedLogs = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredLogs.slice(start, start + rowsPerPage);
  }, [filteredLogs, page, rowsPerPage]);

  const handleDateSort = () => {
    setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
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
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', lg: 'center' }}
        sx={{ mb: 2.25 }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Activity Logs
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Super-admin audit table for important admin actions across the system.
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 160 } }}>
            <InputLabel>Role</InputLabel>
            <Select
              label="Role"
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value as RoleFilter);
                setPage(0);
              }}
            >
              <MenuItem value="all">All Roles</MenuItem>
              <MenuItem value="super_admin">Super Admin</MenuItem>
              <MenuItem value="system_admin">System Admin</MenuItem>
            </Select>
          </FormControl>

          <TextField
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder="Search activity, admin, target"
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

      <TableContainer sx={tableContainerSx}>
        <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              {headCells.map((cell) => (
                <TableCell
                  key={cell.id}
                  sortDirection={cell.sortable ? sortOrder : false}
                  sx={{ bgcolor: 'background.paper', fontWeight: 700, py: 1.25, width: cell.width }}
                >
                  {cell.sortable ? (
                    <TableSortLabel
                      active
                      direction={sortOrder}
                      onClick={handleDateSort}
                    >
                      {cell.label}
                    </TableSortLabel>
                  ) : (
                    cell.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" py={5}>
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">
                      Loading activity logs...
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            ) : null}

            {!loading && paginatedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Box py={5} textAlign="center">
                    <Typography variant="subtitle1" fontWeight={700}>
                      No activity logs found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Try adjusting your search or role filter.
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : null}

            {!loading
              ? paginatedLogs.map((log) => (
                  <TableRow
                    hover
                    key={log.id}
                    onClick={() => router.push(`/activity-logs/${log.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography variant="body2" fontWeight={700} sx={ellipsisSx}>
                        {log.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ...ellipsisSx }}>
                        Target: {log.target.name}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography variant="body2" sx={ellipsisSx}>
                        {log.actor.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ...ellipsisSx }}>
                        {log.actor.email}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Chip
                        size="small"
                        label={formatRole(log.actor.role)}
                        color={log.actor.role === 'super_admin' ? 'primary' : 'warning'}
                        variant="outlined"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1.25 }}>
                      <Typography variant="body2" sx={{ ...ellipsisSx, whiteSpace: 'nowrap' }}>
                        {formatDateTime(log.createdAt)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={filteredLogs.length}
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
    </Paper>
  );
}
