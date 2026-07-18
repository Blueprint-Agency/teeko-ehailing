'use client';
import {
  Box, Typography, Drawer, Button, Stack, Card, CardContent,
  Divider, TextField, Alert, Chip, CircularProgress,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useRbac } from '@/hooks/useRbac';
import { StatusChip } from '@/components/data/StatusChip';
import { useEffect, useState } from 'react';
import { adminApi, type DisputeRow, type DisputeAction } from '@/lib/api';

export default function DisputeQueuePage() {
  const { can } = useRbac();
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<DisputeRow | null>(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminApi.getDisputes('dispute'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const columns: GridColDef<DisputeRow>[] = [
    { field: 'id', headerName: 'ID', width: 90, valueFormatter: (value) => String(value).slice(0, 8) },
    { field: 'tripId', headerName: 'Trip', width: 90, valueFormatter: (value) => value ?? '—' },
    { field: 'raisedBy', headerName: 'Raised By', width: 110, renderCell: ({ row }) => <Chip label={`${row.raisedBy}`} size="small" color={row.raisedBy === 'rider' ? 'info' : 'secondary'} /> },
    { field: 'raiserName', headerName: 'Name', width: 150 },
    { field: 'category', headerName: 'Category', width: 150, valueFormatter: (value) => String(value).replace(/_/g, ' ') },
    { field: 'amount', headerName: 'Amount (RM)', width: 110, type: 'number', valueFormatter: (value) => (value ? Number(value).toFixed(2) : '—') },
    { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    { field: 'createdAt', headerName: 'Date', width: 170, valueFormatter: (value) => new Date(value as string).toLocaleString() },
    { field: 'actions', headerName: '', width: 90, sortable: false, renderCell: ({ row }) => <Button size="small" onClick={() => { setSelected(row); setNote(''); }}>Review</Button> },
  ];

  const act = async (action: DisputeAction, label: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await adminApi.resolveDispute(selected.id, action, note || undefined);
      setDone(`Dispute ${selected.id.slice(0, 8)} ${label}.`);
      setSelected(null);
      setNote('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Dispute Queue</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ height: 500 }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}><CircularProgress /></Stack>
        ) : (
          <DataGrid rows={rows} columns={columns} pageSizeOptions={[25]} disableRowSelectionOnClick />
        )}
      </Box>

      <Drawer anchor="right" open={!!selected} onClose={() => setSelected(null)} PaperProps={{ sx: { width: 380, p: 3 } }}>
        {selected && (
          <>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>Dispute Review</Typography>
            <Divider sx={{ mb: 2 }} />
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="body2" fontWeight={600} textTransform="capitalize">{selected.category.replace(/_/g, ' ')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Trip {selected.tripId ?? '—'} · Raised by {selected.raiserName} ({selected.raisedBy})
                </Typography>
                {selected.amount > 0 && <Typography variant="body2" mt={0.5}>Amount: <strong>RM {selected.amount.toFixed(2)}</strong></Typography>}
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2">{selected.description}</Typography>
              </CardContent>
            </Card>
            <TextField label="Notes / Decision reason" multiline rows={3} fullWidth size="small" sx={{ mb: 2 }} value={note} onChange={(e) => setNote(e.target.value)} />
            {can('resolve_dispute') ? (
              <Stack spacing={1}>
                {can('approve_refund') && selected.amount > 0 && (
                  <Button variant="contained" color="warning" disabled={busy} onClick={() => act('approve_refund', `→ refund approved (RM ${selected.amount.toFixed(2)})`)}>
                    Approve Refund (RM {selected.amount.toFixed(2)})
                  </Button>
                )}
                <Button variant="outlined" color="error" disabled={busy || !note} onClick={() => act('reject', 'rejected')}>Reject Dispute</Button>
              </Stack>
            ) : (
              <Alert severity="info">You don&apos;t have permission to resolve disputes.</Alert>
            )}
          </>
        )}
      </Drawer>
    </Box>
  );
}
