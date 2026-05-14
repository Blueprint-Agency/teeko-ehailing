'use client';
import {
  Box, Typography, Grid, Card, CardContent, Button, Stack,
  Table, TableBody, TableRow, TableCell, Alert, Chip,
} from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import { useRiderStore } from '@/stores/rider';
import { useTripStore } from '@/stores/trip';
import { useRbac } from '@/hooks/useRbac';
import { StatusChip } from '@/components/data/StatusChip';
import { ArrowBack } from '@mui/icons-material';
import { useState } from 'react';

export default function RiderProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const riders = useRiderStore((s) => s.riders);
  const updateStatus = useRiderStore((s) => s.updateRiderStatus);
  const trips = useTripStore((s) => s.trips);
  const { can } = useRbac();
  const [done, setDone] = useState('');

  const rider = riders.find((r) => r.id === id);
  const riderTrips = trips.filter((t) => t.riderId === id).slice(0, 8);

  if (!rider) return <Box p={4}><Alert severity="error">Rider not found.</Alert></Box>;

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => router.push('/riders')} sx={{ mb: 2 }} size="small">Back to Riders</Button>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>{rider.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{rider.email} · {rider.phone}</Typography>
                  <Stack direction="row" spacing={1} mt={1}>
                    <StatusChip status={rider.status} />
                    {rider.escalation > 0 && <Chip label={`Escalation L${rider.escalation}`} size="small" color={rider.escalation >= 2 ? 'error' : 'warning'} />}
                    <Chip label={rider.city} size="small" variant="outlined" />
                  </Stack>
                </Box>
                <Stack direction="row" spacing={1}>
                  {can('ban_rider') && rider.status !== 'banned' && (
                    <Button variant="outlined" color="error" size="small" onClick={() => { updateStatus(rider.id, 'banned'); setDone('Rider banned.'); }}>Ban Rider</Button>
                  )}
                  {can('ban_rider') && rider.status === 'banned' && (
                    <Button variant="outlined" color="success" size="small" onClick={() => { updateStatus(rider.id, 'active'); setDone('Rider unbanned.'); }}>Unban</Button>
                  )}
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {[
          { label: 'Total Trips', value: rider.trips },
          { label: 'Rating', value: rider.rating },
          { label: 'Total Spent', value: `RM ${rider.totalSpent}` },
          { label: 'Joined', value: rider.joinDate },
        ].map(({ label, value }) => (
          <Grid item xs={6} sm={3} key={label}>
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="h6" fontWeight={700}>{value}</Typography>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        <Grid item xs={12}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Recent Trips</Typography>
              <Table size="small">
                <TableBody>
                  {riderTrips.length === 0 ? (
                    <TableRow><TableCell><Typography variant="caption" color="text.secondary">No trips yet.</Typography></TableCell></TableRow>
                  ) : riderTrips.map((t) => (
                    <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => router.push(`/trips/${t.id}`)}>
                      <TableCell><Typography variant="caption">{new Date(t.date).toLocaleString()}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{t.pickup} → {t.dropoff}</Typography></TableCell>
                      <TableCell><StatusChip status={t.status} /></TableCell>
                      <TableCell><Typography variant="caption">RM {t.fare.toFixed(2)}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
