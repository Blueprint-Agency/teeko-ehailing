'use client';
import {
  Box, Typography, Drawer, Button, Stack, Card, CardContent,
  Divider, TextField, Alert,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { StatusChip } from '@/components/data/StatusChip';
import { useState } from 'react';
import { useRbac } from '@/hooks/useRbac';

const APPEALS = [
  { id: 'ap1', driverName: 'Nurul Hazirah Bt Salleh', city: 'KL',    category: 'Standard', reason: 'Single incident, never happened before. Please reinstate.', date: '2026-05-10', status: 'approved' },
  { id: 'ap2', driverName: 'Normah Binti Ahmad',       city: 'Shah Alam','category': 'Economy',  reason: 'I was ill during that period. Medical cert attached.',       date: '2026-05-12', status: 'pending'  },
];

export default function AppealsPage() {
  const { can } = useRbac();
  const [selected, setSelected] = useState<typeof APPEALS[0] | null>(null);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState('');

  const columns: GridColDef[] = [
    { field: 'driverName', headerName: 'Driver',   flex: 1, minWidth: 160 },
    { field: 'city',       headerName: 'City',     width: 120 },
    { field: 'category',   headerName: 'Category', width: 100 },
    { field: 'date',       headerName: 'Date',     width: 110 },
    { field: 'status',     headerName: 'Status',   width: 110, renderCell: ({ value }) => <StatusChip status={value} /> },
    { field: 'actions',    headerName: '',         width: 80, sortable: false,
      renderCell: ({ row }) => <Button size="small" onClick={() => setSelected(row)}>Review</Button> },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Suspension Appeals</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      <Box sx={{ height: 400 }}>
        <DataGrid rows={APPEALS} columns={columns} pageSizeOptions={[25]} disableRowSelectionOnClick />
      </Box>
      <Drawer anchor="right" open={!!selected} onClose={() => setSelected(null)} PaperProps={{ sx: { width: 360, p: 3 } }}>
        {selected && (
          <>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>Appeal Review</Typography>
            <Divider sx={{ mb: 2 }} />
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="body2" fontWeight={600}>{selected.driverName}</Typography>
                <Typography variant="caption" color="text.secondary">{selected.city} · {selected.category}</Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2">{selected.reason}</Typography>
              </CardContent>
            </Card>
            <TextField label="Decision notes" multiline rows={3} fullWidth size="small" sx={{ mb: 2 }} value={reason} onChange={(e) => setReason(e.target.value)} />
            {can('reinstate_driver') ? (
              <Stack direction="row" spacing={1}>
                <Button variant="contained" color="success" fullWidth disabled={!reason} onClick={() => { setDone('Appeal approved — driver reinstated.'); setSelected(null); setReason(''); }}>Approve</Button>
                <Button variant="outlined" color="error" fullWidth disabled={!reason} onClick={() => { setDone('Appeal rejected.'); setSelected(null); setReason(''); }}>Reject</Button>
              </Stack>
            ) : (
              <Alert severity="info">You don't have permission to decide on appeals.</Alert>
            )}
          </>
        )}
      </Drawer>
    </Box>
  );
}
