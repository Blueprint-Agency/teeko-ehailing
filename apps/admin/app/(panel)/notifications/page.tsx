'use client';
import {
  Box, Typography, Grid, Card, CardContent, TextField, Button,
  Alert, Stack, Chip, Select, MenuItem, FormControl, InputLabel, Divider,
  CircularProgress,
} from '@mui/material';
import { useAdminAuthStore } from '@/stores/auth';
import { useRbac } from '@/hooks/useRbac';
import { adminApi, BroadcastRecord } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';

const SEGMENTS = [
  { value: 'all_riders', label: 'All Riders' },
  { value: 'all_drivers', label: 'All Drivers' },
];

export default function NotificationsPage() {
  const profile = useAdminAuthStore((s) => s.profile);
  const { can } = useRbac();

  const [segment, setSegment] = useState('all_riders');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  const [history, setHistory] = useState<BroadcastRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const rows = await adminApi.getBroadcasts();
      setHistory(rows);
    } catch {
      // non-fatal — history just stays empty
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const handleSend = async () => {
    setError('');
    setSending(true);
    try {
      const result = await adminApi.sendBroadcast({ segment, title, message });
      setDone(`Notification sent to ${result.reach} recipients.`);
      setTitle('');
      setMessage('');
      void loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send notification.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Broadcast Notifications</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={2}>
        {can('send_notifications') && (
          <Grid item xs={12} md={5}>
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} mb={2}>Compose Message</Typography>
                <Stack spacing={2}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Segment</InputLabel>
                    <Select value={segment} label="Segment" onChange={(e) => setSegment(e.target.value)}>
                      {SEGMENTS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Title"
                    fullWidth
                    size="small"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    inputProps={{ maxLength: 80 }}
                    helperText={`${title.length}/80`}
                  />
                  <TextField
                    label="Message"
                    fullWidth
                    size="small"
                    multiline
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    inputProps={{ maxLength: 300 }}
                    helperText={`${message.length}/300`}
                  />
                  <Button
                    variant="contained"
                    disabled={!title || !message || sending}
                    onClick={handleSend}
                    startIcon={sending ? <CircularProgress size={16} color="inherit" /> : undefined}
                  >
                    {sending ? 'Sending…' : 'Send Notification'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}

        <Grid item xs={12} md={7}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Sent History</Typography>
              {historyLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : history.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No broadcasts sent yet.</Typography>
              ) : (
                <Stack spacing={1.5} divider={<Divider />}>
                  {history.map((n) => (
                    <Box key={n.id}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                        <Typography variant="body2" fontWeight={600}>{n.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(n.sentAt).toLocaleString()}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" display="block">{n.message}</Typography>
                      <Stack direction="row" spacing={1} mt={0.5}>
                        <Chip label={n.segment.replace('_', ' ')} size="small" variant="outlined" />
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
