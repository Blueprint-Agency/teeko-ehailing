'use client';
import {
  Box, Typography, Grid, Card, CardContent, Button, Stack,
  Table, TableBody, TableRow, TableCell, Alert, Chip, Divider,
} from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import { useTripStore } from '@/stores/trip';
import { useDriverStore } from '@/stores/driver';
import { useRiderStore } from '@/stores/rider';
import { useRbac } from '@/hooks/useRbac';
import { StatusChip } from '@/components/data/StatusChip';
import { ArrowBack } from '@mui/icons-material';
import { useState } from 'react';

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const trips = useTripStore((s) => s.trips);
  const drivers = useDriverStore((s) => s.drivers);
  const riders = useRiderStore((s) => s.riders);
  const { can } = useRbac();
  const [done, setDone] = useState('');

  const trip = trips.find((t) => t.id === id);
  const driver = drivers.find((d) => d.id === trip?.driverId);
  const rider = riders.find((r) => r.id === trip?.riderId);

  if (!trip) return <Box p={4}><Alert severity="error">Trip not found.</Alert></Box>;

  const platformFee = trip.commission;
  const driverEarning = trip.fare - trip.commission;

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => router.push('/trips')} sx={{ mb: 2 }} size="small">Back to Trips</Button>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>Trip {trip.id}</Typography>
                <StatusChip status={trip.status} />
              </Box>
              <Typography variant="caption" color="text.secondary">{new Date(trip.date).toLocaleString()}</Typography>
              <Divider sx={{ my: 1.5 }} />
              <Table size="small">
                <TableBody>
                  {[
                    ['Pickup',   trip.pickup],
                    ['Dropoff',  trip.dropoff],
                    ['Distance', `${trip.distance} km`],
                    ['Category', trip.category],
                    ['City',     trip.city],
                    ['Payment',  trip.paymentMethod],
                    ['Surge',    trip.surge > 1 ? `${trip.surge}×` : 'None'],
                  ].map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell sx={{ color: 'text.secondary', width: 120 }}><Typography variant="caption">{k}</Typography></TableCell>
                      <TableCell><Typography variant="caption" fontWeight={500}>{v}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            {/* Fare breakdown */}
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Fare Breakdown</Typography>
                <Table size="small">
                  <TableBody>
                    <TableRow><TableCell>Base fare</TableCell><TableCell align="right">RM {trip.fare.toFixed(2)}</TableCell></TableRow>
                    <TableRow><TableCell>Platform fee (20%)</TableCell><TableCell align="right" sx={{ color: 'error.main' }}>− RM {platformFee.toFixed(2)}</TableCell></TableRow>
                    <TableRow><TableCell sx={{ fontWeight: 700 }}>Driver earns</TableCell><TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>RM {driverEarning.toFixed(2)}</TableCell></TableRow>
                  </TableBody>
                </Table>
                {trip.dispute && can('approve_refund') && (
                  <Stack direction="row" spacing={1} mt={2}>
                    <Button variant="contained" color="warning" size="small" fullWidth onClick={() => setDone('Refund issued.')}>Issue Refund</Button>
                  </Stack>
                )}
              </CardContent>
            </Card>

            {/* Parties */}
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} mb={1}>Parties</Typography>
                <Typography variant="body2">Driver: <strong>{driver?.name ?? trip.driverId}</strong></Typography>
                <Button size="small" sx={{ p: 0, mt: 0.25 }} onClick={() => router.push(`/drivers/${trip.driverId}`)}>View driver</Button>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2">Rider: <strong>{rider?.name ?? trip.riderId}</strong></Typography>
                <Button size="small" sx={{ p: 0, mt: 0.25 }} onClick={() => router.push(`/riders/${trip.riderId}`)}>View rider</Button>
              </CardContent>
            </Card>

            {trip.dispute && (
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'error.main' }}>
                <CardContent sx={{ p: 2 }}>
                  <Chip label="Dispute filed" color="error" size="small" sx={{ mb: 1 }} />
                  <Typography variant="caption" display="block" color="text.secondary">
                    This trip has an active dispute. Review in the Disputes section.
                  </Typography>
                  <Button size="small" sx={{ mt: 1 }} onClick={() => router.push('/disputes')}>Go to Disputes</Button>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
