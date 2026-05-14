'use client';
import {
  Box, Typography, Grid, Card, CardContent, TextField, Button,
  Alert, Stack, Chip, Select, MenuItem, FormControl, InputLabel, Divider,
} from '@mui/material';
import { useNotificationStore } from '@/stores/notification';
import { useAdminAuthStore } from '@/stores/auth';
import { useRbac } from '@/hooks/useRbac';
import { useState } from 'react';

const SEGMENTS = [
  { value: 'all_drivers', label: 'All Drivers' },
  { value: 'all_riders', label: 'All Riders' },
  { value: 'city_kl', label: 'Kuala Lumpur (Riders + Drivers)' },
  { value: 'city_pj', label: 'Petaling Jaya (Riders + Drivers)' },
];

const REACH: Record<string, number> = { all_drivers: 18, all_riders: 15, city_kl: 24, city_pj: 12 };

export default function NotificationsPage() {
  const notifications = useNotificationStore((s) => s.notifications);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const profile = useAdminAuthStore((s) => s.profile);
  const { can } = useRbac();

  const [segment, setSegment] = useState('all_drivers');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState('');

  const handleSend = () => {
    addNotification({ segment, title, message, sentBy: profile?.id ?? 'unknown', reach: REACH[segment] ?? 0 });
    setDone(`Notification sent to ${REACH[segment]} users.`);
    setTitle(''); setMessage('');
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Broadcast Notifications</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}

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
                  <Chip label={`~${REACH[segment]} recipients`} size="small" color="info" sx={{ alignSelf: 'flex-start' }} />
                  <TextField label="Title" fullWidth size="small" value={title} onChange={(e) => setTitle(e.target.value)} inputProps={{ maxLength: 80 }} helperText={`${title.length}/80`} />
                  <TextField label="Message" fullWidth size="small" multiline rows={4} value={message} onChange={(e) => setMessage(e.target.value)} inputProps={{ maxLength: 300 }} helperText={`${message.length}/300`} />
                  <Button variant="contained" disabled={!title || !message} onClick={handleSend}>Send Notification</Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}

        <Grid item xs={12} md={7}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Sent History</Typography>
              <Stack spacing={1.5} divider={<Divider />}>
                {notifications.map((n) => (
                  <Box key={n.id}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                      <Typography variant="body2" fontWeight={600}>{n.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{new Date(n.sentAt).toLocaleString()}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block">{n.message}</Typography>
                    <Stack direction="row" spacing={1} mt={0.5}>
                      <Chip label={n.segment.replace('_', ' ')} size="small" variant="outlined" />
                      <Chip label={`${n.reach} recipients`} size="small" />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
