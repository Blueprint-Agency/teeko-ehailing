'use client';
import {
  Box, Typography, Drawer, Button, Stack, Card, CardContent,
  Divider, TextField, Alert, Chip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useDisputeStore } from '@/stores/dispute';
import { useRbac } from '@/hooks/useRbac';
import { StatusChip } from '@/components/data/StatusChip';
import { useState } from 'react';

export default function DisputesPage() {
  const disputes = useDisputeStore((s) => s.disputes);
  const updateStatus = useDisputeStore((s) => s.updateDisputeStatus);
  const { can } = useRbac();
  const [selected, setSelected] = useState<typeof disputes[0] | null>(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState('');

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'tripId', headerName: 'Trip', width: 80 },
    { field: 'raisedBy', headerName: 'Raised By', width: 100, renderCell: ({ value }) => <Chip label={value} size="small" color={value === 'rider' ? 'info' : 'secondary'} /> },
    { field: 'category', headerName: 'Category', width: 130, valueFormatter: ({ value }) => String(value).replace('_', ' ') },
    { field: 'amount', headerName: 'Amount (RM)', width: 110, type: 'number' },
    { field: 'status', headerName: 'Status', width: 110, renderCell: ({ value }) => <StatusChip status={value} /> },
    { field: 'date', headerName: 'Date', width: 170, valueFormatter: ({ value }) => new Date(value as string).toLocaleString() },
    { field: 'actions', headerName: '', width: 80, sortable: false, renderCell: ({ row }) => <Button size="small" onClick={() => setSelected(row)}>Review</Button> },
  ];

  const resolve = (resolution: string, newStatus: string) => {
    if (!selected) return;
    updateStatus(selected.id, newStatus, resolution);
    setDone(`Dispute ${selected.id} ${resolution.replace('_', ' ')}.`);
    setSelected(null);
    setNote('');
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Disputes Queue</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      <Box sx={{ height: 500 }}>
        <DataGrid rows={disputes} columns={columns} pageSizeOptions={[25]} disableRowSelectionOnClick />
      </Box>

      <Drawer anchor="right" open={!!selected} onClose={() => setSelected(null)} PaperProps={{ sx: { width: 380, p: 3 } }}>
        {selected && (
          <>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>Dispute Review</Typography>
            <Divider sx={{ mb: 2 }} />
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="body2" fontWeight={600} textTransform="capitalize">{selected.category.replace('_', ' ')}</Typography>
                <Typography variant="caption" color="text.secondary">Trip {selected.tripId} · Raised by {selected.raisedBy}</Typography>
                {selected.amount > 0 && <Typography variant="body2" mt={0.5}>Amount: <strong>RM {selected.amount}</strong></Typography>}
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2">{selected.description}</Typography>
              </CardContent>
            </Card>
            <TextField label="Notes / Decision reason" multiline rows={3} fullWidth size="small" sx={{ mb: 2 }} value={note} onChange={(e) => setNote(e.target.value)} />
            {can('resolve_dispute') ? (
              <Stack spacing={1}>
                {can('approve_refund') && selected.amount > 0 && (
                  <Button variant="contained" color="warning" onClick={() => resolve('approved_refund', 'resolved')}>Approve Refund (RM {selected.amount})</Button>
                )}
                <Button variant="outlined" color="error" onClick={() => resolve('rejected', 'resolved')} disabled={!note}>Reject Dispute</Button>
                <Button variant="outlined" onClick={() => resolve('escalated', 'escalated')}>Escalate to Super Admin</Button>
              </Stack>
            ) : (
              <Alert severity="info">You don't have permission to resolve disputes.</Alert>
            )}
          </>
        )}
      </Drawer>
    </Box>
  );
}
