'use client';
import {
  Box, Typography, Drawer, Button, Stack, Card, CardContent,
  Divider, TextField, Alert, Chip,
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { useSupportStore } from '@/stores/support';
import { StatusChip } from '@/components/data/StatusChip';
import { useState } from 'react';

const PRIORITY_COLOR: Record<string, 'default' | 'error' | 'warning' | 'info'> = {
  low: 'default', medium: 'info', high: 'warning', urgent: 'error',
};

export default function SupportPage() {
  const tickets = useSupportStore((s) => s.tickets);
  const updateStatus = useSupportStore((s) => s.updateTicketStatus);
  const [selected, setSelected] = useState<typeof tickets[0] | null>(null);
  const [reply, setReply] = useState('');
  const [done, setDone] = useState('');

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'subject', headerName: 'Subject', flex: 2, minWidth: 200 },
    { field: 'raisedBy', headerName: 'From', width: 90, renderCell: ({ value }) => <Chip label={value} size="small" color={value === 'rider' ? 'info' : 'secondary'} /> },
    { field: 'category', headerName: 'Category', width: 110 },
    { field: 'priority', headerName: 'Priority', width: 90, renderCell: ({ value }) => <Chip label={value} size="small" color={PRIORITY_COLOR[value] ?? 'default'} /> },
    { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusChip status={value} /> },
    { field: 'date', headerName: 'Date', width: 160, valueFormatter: ({ value }) => new Date(value as string).toLocaleString() },
    { field: 'actions', headerName: '', width: 80, sortable: false, renderCell: ({ row }) => <Button size="small" onClick={() => setSelected(row)}>Open</Button> },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Support Tickets</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      <Box sx={{ height: 560 }}>
        <DataGrid
          rows={tickets} columns={columns}
          pageSizeOptions={[25]} disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
        />
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
            <TextField label="Reply / Notes" multiline rows={4} fullWidth size="small" sx={{ mb: 2 }} value={reply} onChange={(e) => setReply(e.target.value)} />
            <Stack spacing={1}>
              <Button variant="contained" color="success" disabled={!reply} onClick={() => { updateStatus(selected.id, 'resolved'); setDone(`Ticket ${selected.id} resolved.`); setSelected(null); setReply(''); }}>Resolve</Button>
              <Button variant="outlined" onClick={() => { updateStatus(selected.id, 'in_progress'); setDone(`Ticket ${selected.id} set to in progress.`); setSelected(null); }}>Set In Progress</Button>
              <Button variant="outlined" color="warning" onClick={() => { updateStatus(selected.id, 'escalated'); setDone(`Ticket ${selected.id} escalated.`); setSelected(null); }}>Escalate</Button>
            </Stack>
          </>
        )}
      </Drawer>
    </Box>
  );
}
