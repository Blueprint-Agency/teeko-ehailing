'use client';
import {
  Box, Typography, Drawer, Button, Stack, Card, CardContent,
  Divider, TextField, Alert, Chip, CircularProgress,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useRbac } from '@/hooks/useRbac';
import { StatusChip } from '@/components/data/StatusChip';
import { useEffect, useState } from 'react';
import { adminApi, type DisputeRow, type RefundStatus } from '@/lib/api';

export default function RefundQueuePage() {
  const { can } = useRbac();
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<DisputeRow | null>(null);
  const [note, setNote] = useState('');
  const [ref, setRef] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminApi.getDisputes('refund'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load refunds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const open = (row: DisputeRow) => {
    setSelected(row);
    setNote(row.refundNote ?? '');
    setRef(row.refundRef ?? '');
  };

  const columns: GridColDef<DisputeRow>[] = [
    { field: 'id', headerName: 'ID', width: 90, valueFormatter: (value) => String(value).slice(0, 8) },
    { field: 'tripId', headerName: 'Trip', width: 90, valueFormatter: (value) => value ?? '—' },
    { field: 'raiserName', headerName: 'Rider / Driver', width: 160 },
    { field: 'category', headerName: 'Reason', width: 150, valueFormatter: (value) => String(value).replace(/_/g, ' ') },
    { field: 'amount', headerName: 'Refund (RM)', width: 120, type: 'number', valueFormatter: (value) => Number(value).toFixed(2) },
    { field: 'refundRef', headerName: 'Ref', width: 130, valueFormatter: (value) => value ?? '—' },
    { field: 'status', headerName: 'Refund Status', width: 150, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    { field: 'createdAt', headerName: 'Raised', width: 170, valueFormatter: (value) => new Date(value as string).toLocaleString() },
    { field: 'actions', headerName: '', width: 90, sortable: false, renderCell: ({ row }) => <Button size="small" onClick={() => open(row)}>Manage</Button> },
  ];

  const setStatus = async (status: RefundStatus, label: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await adminApi.updateRefundStatus(selected.id, status, note || undefined, ref || undefined);
      setDone(`Refund for ${selected.id.slice(0, 8)} ${label}.`);
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const pendingTotal = rows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={0.5}>Refund Queue</Typography>
      <Typography variant="body2" color="text.secondary" mb={2.5}>
        Disputes approved for refund — track and manage payout status. Total in flight: <strong>RM {pendingTotal.toFixed(2)}</strong>
      </Typography>
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
            <Typography variant="subtitle1" fontWeight={700} mb={1}>Manage Refund</Typography>
            <Divider sx={{ mb: 2 }} />
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={600}>RM {selected.amount.toFixed(2)}</Typography>
                  <StatusChip status={selected.status} />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Trip {selected.tripId ?? '—'} · {selected.raiserName} ({selected.raisedBy})
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2">{selected.description}</Typography>
                {selected.resolutionNote && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="text.secondary">Approval note</Typography>
                    <Typography variant="body2">{selected.resolutionNote}</Typography>
                  </>
                )}
              </CardContent>
            </Card>

            <TextField label="Refund reference (e.g. payout ID)" fullWidth size="small" sx={{ mb: 2 }} value={ref} onChange={(e) => setRef(e.target.value)} />
            <TextField label="Refund notes" multiline rows={2} fullWidth size="small" sx={{ mb: 2 }} value={note} onChange={(e) => setNote(e.target.value)} />

            {can('approve_refund') ? (
              <Stack spacing={1}>
                {selected.status !== 'refund_processing' && (
                  <Button variant="outlined" disabled={busy} onClick={() => setStatus('refund_processing', 'marked processing')}>Mark Processing</Button>
                )}
                <Button variant="contained" color="success" disabled={busy} onClick={() => setStatus('refund_completed', 'completed')}>Mark Refunded</Button>
                <Button variant="outlined" color="error" disabled={busy} onClick={() => setStatus('refund_failed', 'marked failed')}>Mark Failed</Button>
              </Stack>
            ) : (
              <Alert severity="info">You don&apos;t have permission to manage refunds.</Alert>
            )}
          </>
        )}
      </Drawer>
    </Box>
  );
}
