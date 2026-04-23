'use client';

import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Chip, CircularProgress, Divider, Paper, Stack, Typography } from '@mui/material';
import { auth } from '@/lib/firebase';
import { DetailCard, DetailPageHeader } from '@/components/DetailPageScaffold';

type ActivityLogDetails = {
  id: string;
  actor: {
    uid: string;
    name: string;
    email: string;
    role: string;
    type: string;
  };
  action: string;
  module: string;
  subject?: {
    type?: string;
    id?: string;
    name?: string;
  } | null;
  target: {
    type: string;
    id: string;
    name: string;
  };
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

const formatDateTime = (value: string) => {
  if (!value) {
    return 'Unknown time';
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

const sentenceCase = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatMetadataValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') {
    return 'none';
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object' && 'field' in item && 'from' in item && 'to' in item) {
          const change = item as { field?: unknown; from?: unknown; to?: unknown };
          return `${String(change.field)} changed from ${String(change.from)} to ${String(change.to)}`;
        }

        return formatMetadataValue(item);
      })
      .join('; ');
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${sentenceCase(key)}: ${formatMetadataValue(item)}`)
      .join(', ');
  }

  return String(value);
};

const buildMetadataSentence = (metadata: Record<string, unknown>) => {
  const entries = Object.entries(metadata);

  if (entries.length === 0) {
    return 'No extra metadata was stored for this activity.';
  }

  return entries
    .map(([key, value]) => `${sentenceCase(key)}: ${formatMetadataValue(value)}`)
    .join('. ');
};

export default function ActivityLogDetailsPage({ logId }: { logId: string }) {
  const router = useRouter();
  const [log, setLog] = useState<ActivityLogDetails | null>(null);
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

  const loadLog = useEffectEvent(async () => {
    try {
      setLoading(true);
      setError('');

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/activity-logs/${logId}`, { headers });
      const data = (await response.json().catch(() => null)) as
        | { log?: ActivityLogDetails; error?: string }
        | null;

      if (!response.ok || !data?.log) {
        setError(data?.error || 'Failed to load activity log.');
        return;
      }

      setLog(data.log);
    } catch (loadError) {
      console.error(loadError);
      setError('Failed to load activity log.');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadLog();
  }, [logId]);

  const detailsSentence = useMemo(() => {
    if (!log) {
      return '';
    }

    const subjectPart = log.subject?.name
      ? ` The related subject was ${log.subject.name}${log.subject.type ? ` (${log.subject.type})` : ''}.`
      : '';

    return `${log.description} This was recorded on ${formatDateTime(log.createdAt)} by ${log.actor.name} (${formatRole(log.actor.role)}) under the ${log.module} module. The target record was ${log.target.name}${log.target.type ? ` (${log.target.type})` : ''}.${subjectPart}`;
  }, [log]);

  return (
    <Stack spacing={2.5}>
      <DetailPageHeader
        title="Activity Log Details"
        description="A readable audit summary for this admin action."
        backLabel="Back to activity logs"
        onBack={() => router.push('/activity-logs')}
      />

      {loading ? (
        <DetailCard>
          <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Loading activity log...
            </Typography>
          </Stack>
        </DetailCard>
      ) : null}

      {!loading && error ? <Alert severity="error">{error}</Alert> : null}

      {!loading && log ? (
        <DetailCard>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {log.description}
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', mt: 1 }}>
                <Chip size="small" label={log.module} variant="outlined" />
                <Chip size="small" label={sentenceCase(log.action)} variant="outlined" />
                <Chip
                  size="small"
                  label={formatRole(log.actor.role)}
                  color={log.actor.role === 'super_admin' ? 'primary' : 'warning'}
                  variant="outlined"
                  sx={{ textTransform: 'capitalize' }}
                />
              </Stack>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              {detailsSentence}
            </Typography>

            <Divider />

            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(15, 23, 42, 0.55)' : 'grey.50'),
                border: '1px solid',
                borderColor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(148, 163, 184, 0.18)' : 'grey.200'),
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                {buildMetadataSentence(log.metadata)}
              </Typography>
            </Paper>

            <Typography variant="caption" color="text.secondary">
              Log reference: {log.id}
            </Typography>
          </Stack>
        </DetailCard>
      ) : null}
    </Stack>
  );
}
