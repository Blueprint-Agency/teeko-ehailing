'use client';
import {
  Box, Typography, Grid, Card, CardContent, TextField, Button,
  Alert, Divider,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useDriverStore } from '@/stores/driver';
import { useRbac } from '@/hooks/useRbac';
import { useState } from 'react';

export default function CommissionsPage() {
  const drivers = useDriverStore((s) => s.drivers);
  const { can } = useRbac();
  const [platformRate, setPlatformRate] = useState('20');
  const [done, setDone] = useState('');

  const overrideRows = drivers
    .filter((d) => d.status === 'active' && d.category === 'Premium')
    .map((d) => ({ ...d, rate: d.id === 'd16' ? 18 : 20 }));

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Driver', flex: 1, minWidth: 160 },
    { field: 'category', headerName: 'Category', width: 100 },
    { field: 'trips', headerName: 'Trips', width: 80, type: 'number' },
    { field: 'rate', headerName: 'Rate (%)', width: 100, type: 'number', editable: can('adjust_commission') },
    { field: 'earnings', headerName: 'Total Earnings (RM)', width: 160, type: 'number' },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Commission Settings</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={2}>Platform-wide Default Rate</Typography>
              <TextField
                label="Commission Rate (%)" value={platformRate} size="small" fullWidth type="number"
                onChange={(e) => setPlatformRate(e.target.value)}
                disabled={!can('adjust_commission')}
                inputProps={{ min: 5, max: 40 }}
                helperText="Applied to all drivers without a per-driver override"
              />
              {can('adjust_commission') && (
                <Button variant="contained" sx={{ mt: 2 }} size="small" onClick={() => setDone(`Platform rate updated to ${platformRate}%.`)}>
                  Save Rate
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Per-driver Overrides (Premium)</Typography>
              <Box sx={{ height: 360 }}>
                <DataGrid rows={overrideRows} columns={columns} pageSizeOptions={[25]} disableRowSelectionOnClick />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
