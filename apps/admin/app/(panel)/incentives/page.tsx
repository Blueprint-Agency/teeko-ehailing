'use client';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button,
  Stack, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { useState } from 'react';
import { useRbac } from '@/hooks/useRbac';

const CAMPAIGNS = [
  { id: 'inc1', title: 'Hari Raya Bonus', description: 'RM50 for 40+ trips/week', target: 'all_drivers', startDate: '2026-04-28', endDate: '2026-05-11', status: 'ended', budget: 1000 },
  { id: 'inc2', title: 'New City — Shah Alam Launch', description: 'RM30 bonus for first 20 trips in Shah Alam', target: 'shah_alam', startDate: '2026-05-01', endDate: '2026-05-31', status: 'active', budget: 600 },
  { id: 'inc3', title: 'Weekend Warrior', description: '10% extra on all Saturday/Sunday fares', target: 'all_drivers', startDate: '2026-05-16', endDate: '2026-06-15', status: 'upcoming', budget: 2000 },
];

export default function IncentivesPage() {
  const { can } = useRbac();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState('');

  const statusColor = (s: string) => s === 'active' ? 'success' : s === 'ended' ? 'default' : 'info';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
        <Typography variant="h6" fontWeight={700}>Incentives & Campaigns</Typography>
        {can('manage_incentives') && (
          <Button startIcon={<Add />} variant="contained" size="small" onClick={() => setOpen(true)}>New Campaign</Button>
        )}
      </Box>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}

      <Grid container spacing={2}>
        {CAMPAIGNS.map((c) => (
          <Grid item xs={12} md={4} key={c.id}>
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600}>{c.title}</Typography>
                  <Chip label={c.status} size="small" color={statusColor(c.status) as never} />
                </Box>
                <Typography variant="body2" color="text.secondary" mb={1.5}>{c.description}</Typography>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">Target: {c.target.replace('_', ' ')}</Typography>
                  <Typography variant="caption" color="text.secondary">{c.startDate} → {c.endDate}</Typography>
                  <Typography variant="caption">Budget: <strong>RM {c.budget}</strong></Typography>
                </Stack>
                {can('manage_incentives') && c.status !== 'ended' && (
                  <Button size="small" sx={{ mt: 1.5 }} variant="outlined">Edit</Button>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Campaign</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Campaign Title" fullWidth size="small" />
            <TextField label="Description" fullWidth size="small" multiline rows={2} />
            <TextField label="Target Segment" fullWidth size="small" select SelectProps={{ native: true }}>
              <option>All Drivers</option>
              <option>Premium Only</option>
              <option>Kuala Lumpur</option>
              <option>Petaling Jaya</option>
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField label="Start Date" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} />
              <TextField label="End Date" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} />
            </Stack>
            <TextField label="Budget (RM)" type="number" size="small" fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => { setOpen(false); setDone('Campaign created.'); }}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
