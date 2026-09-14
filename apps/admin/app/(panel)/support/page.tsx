'use client';
import {
  Box, Typography, Drawer, Button, Stack, Card, CardContent,
  Divider, TextField, Alert, Chip, CircularProgress,
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { StatusChip } from '@/components/data/StatusChip';
import { useEffect, useState } from 'react';
import { adminApi, type SupportTicketRow, type SupportTicketStatus } from '@/lib/api';

const PRIORITY_COLOR: Record<string, 'default' | 'error' | 'warning' | 'info'> = {
  low: 'default', medium: 'info', high: 'warning', urgent: 'error',
};

export default function SupportPage() {
  const [rows, setRows] = useState<SupportTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SupportTicketRow | null>(null);
  const [reply, setReply] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminApi.getSupportTickets());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const columns: GridColDef<SupportTicketRow>[] = [
    { field: 'id', headerName: 'ID', width: 90, valueFormatter: (value) => String(value).slice(0, 8) },
    { field: 'subject', headerName: 'Subject', flex: 2, minWidth: 200 },
    { field: 'raisedBy', headerName: 'From', width: 90, renderCell: ({ value }) => <Chip label={value} size="small" color={value === 'rider' ? 'info' : 'secondary'} /> },
    { field: 'category', headerName: 'Category', width: 110 },
    { field: 'priority', headerName: 'Priority', width: 90, renderCell: ({ value }) => <Chip label={value} size="small" color={PRIORITY_COLOR[value as string] ?? 'default'} /> },
    { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    { field: 'date', headerName: 'Date', width: 160, valueFormatter: (value) => new Date(value as string).toLocaleString() },
    { field: 'actions', headerName: '', width: 80, sortable: false, renderCell: ({ row }) => <Button size="small" onClick={() => { setSelected(row); setReply(''); }}>Open</Button> },
  ];

  const setStatus = async (status: SupportTicketStatus, label: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await adminApi.updateSupportStatus(selected.id, status);
      setDone(`Ticket ${selected.id.slice(0, 8)} ${label}.`);
      setSelected(null);
      setReply('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Support Tickets</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Box sx={{ height: 560 }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}><CircularProgress /></Stack>
        ) : (
          <DataGrid
            rows={rows} columns={columns}
            pageSizeOptions={[25]} disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
          />
        )}
      </Box>

      <Drawer anchor="right" open={!!selected} onClose={() => setSelected(null)} PaperProps={{ sx: { width: 400, p: 3 } }}>
        {selected && (
          <>
            <Typography variant="subtitle1" fontWeight={700} mb={0.5}>{selected.subject}</Typography>
            <Stack direction="row" spacing={1} mb={2}>
              <Chip label={selected.raisedBy} size="small" color={selected.raisedBy === 'rider' ? 'info' : 'secondary'} />
              <Chip label={selected.priority} size="small" color={PRIORITY_COLOR[selected.priority]} />
              <StatusChip status={selected.status} />
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">{selected.category} · {new Date(selected.date).toLocaleString()}</Typography>
                <Typography variant="body2" mt={0.5}>User ID: {selected.userId}</Typography>
              </CardContent>
            </Card>
            {/* Phase 1 is status-only — the reply text is for the admin's reference
                and isn't persisted yet (no ticket thread). */}
            <TextField label="Reply / Notes" multiline rows={4} fullWidth size="small" sx={{ mb: 2 }} value={reply} onChange={(e) => setReply(e.target.value)} />
            <Stack spacing={1}>
              <Button variant="contained" color="success" disabled={busy} onClick={() => setStatus('resolved', 'resolved')}>Resolve</Button>
              <Button variant="outlined" disabled={busy} onClick={() => setStatus('in_progress', 'set to in progress')}>Set In Progress</Button>
              <Button variant="outlined" color="warning" disabled={busy} onClick={() => setStatus('escalated', 'escalated')}>Escalate</Button>
            </Stack>
          </>
        )}
      </Drawer>
    </Box>
  );
}
