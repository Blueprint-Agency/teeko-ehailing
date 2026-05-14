'use client';
import {
  Box, Typography, Grid, Card, CardContent, Button, Chip,
  Divider, Stack, Table, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Alert,
} from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import { useDriverStore } from '@/stores/driver';
import { useTripStore } from '@/stores/trip';
import { useRbac } from '@/hooks/useRbac';
import { StatusChip } from '@/components/data/StatusChip';
import { useState } from 'react';
import { ArrowBack } from '@mui/icons-material';

export default function DriverProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const router = useRouter();
  const drivers = useDriverStore((s) => s.drivers);
  const updateStatus = useDriverStore((s) => s.updateDriverStatus);
  const trips = useTripStore((s) => s.trips);
  const { can } = useRbac();

  const driver = drivers.find((d) => d.id === id);
  const driverTrips = trips.filter((t) => t.driverId === id).slice(0, 10);

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: string; newStatus: string }>({ open: false, action: '', newStatus: '' });
  const [reason, setReason] = useState('');
  const [done, setDone] = useState('');

  if (!driver) {
    return <Box p={4}><Alert severity="error">Driver not found.</Alert></Box>;
  }

  const openConfirm = (action: string, newStatus: string) =>
    setConfirmDialog({ open: true, action, newStatus });

  const handleConfirm = () => {
    updateStatus(driver.id, confirmDialog.newStatus);
    setDone(`Driver status updated to ${confirmDialog.newStatus}.`);
    setConfirmDialog({ open: false, action: '', newStatus: '' });
    setReason('');
  };

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => router.push('/drivers')} sx={{ mb: 2 }} size="small">
        Back to Drivers
      </Button>

      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}

      <Grid container spacing={2}>
        {/* Profile header */}
        <Grid item xs={12}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={700}>{driver.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{driver.email} · {driver.phone}</Typography>
                  <Stack direction="row" spacing={1} mt={1}>
                    <StatusChip status={driver.status} />
                    <Chip label={driver.category} size="small" variant="outlined" />
                    <Chip label={`EVP: ${driver.evp.replace('_', ' ')}`} size="small" color={driver.evp === 'approved' ? 'success' : 'warning'} />
                  </Stack>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {can('approve_driver') && driver.status === 'pending' && (
                    <Button variant="contained" color="success" size="small" onClick={() => openConfirm('Approve', 'active')}>Approve</Button>
                  )}
                  {can('suspend_driver') && driver.status === 'active' && (
                    <Button variant="outlined" color="warning" size="small" onClick={() => openConfirm('Suspend', 'suspended')}>Suspend</Button>
                  )}
                  {can('reinstate_driver') && driver.status === 'suspended' && (
                    <Button variant="outlined" color="success" size="small" onClick={() => openConfirm('Reinstate', 'active')}>Reinstate</Button>
                  )}
                  {can('deactivate_driver') && driver.status === 'active' && (
                    <Button variant="outlined" color="error" size="small" onClick={() => openConfirm('Deactivate', 'inactive')}>Deactivate</Button>
                  )}
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Stats */}
        {[
          { label: 'Total Trips', value: driver.trips },
          { label: 'Rating', value: driver.rating || '—' },
          { label: 'Total Earnings', value: `RM ${driver.earnings.toLocaleString()}` },
          { label: 'City', value: driver.city },
          { label: 'Joined', value: driver.joinDate },
          { label: 'Vehicle', value: `${driver.vehicle} (${driver.plate})` },
        ].map(({ label, value }) => (
          <Grid item xs={6} sm={4} md={2} key={label}>
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="h6" fontWeight={700}>{value}</Typography>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Recent trips */}
        <Grid item xs={12}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Recent Trips</Typography>
              <Table size="small">
                <TableBody>
                  {driverTrips.length === 0 ? (
                    <TableRow><TableCell colSpan={6}><Typography variant="caption" color="text.secondary">No trips yet.</Typography></TableCell></TableRow>
                  ) : driverTrips.map((t) => (
                    <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => router.push(`/trips/${t.id}`)}>
                      <TableCell><Typography variant="caption">{new Date(t.date).toLocaleString()}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{t.pickup} → {t.dropoff}</Typography></TableCell>
                      <TableCell><StatusChip status={t.status} /></TableCell>
                      <TableCell><Typography variant="caption">RM {t.fare.toFixed(2)}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{t.surge > 1 ? `${t.surge}× surge` : '—'}</Typography></TableCell>
                      <TableCell>{t.dispute && <Chip label="Dispute" size="small" color="error" />}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Confirm dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, action: '', newStatus: '' })} maxWidth="xs" fullWidth>
        <DialogTitle>{confirmDialog.action} Driver</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            You are about to <strong>{confirmDialog.action.toLowerCase()}</strong>{' '}
            <strong>{driver.name}</strong>. Please provide a reason.
          </Typography>
          <TextField
            label="Reason" fullWidth multiline rows={2} size="small"
            value={reason} onChange={(e) => setReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, action: '', newStatus: '' })}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirm} disabled={!reason}>Confirm</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
