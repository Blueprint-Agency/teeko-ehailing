'use client';
import {
  Box, Typography, Drawer, Button, Stack, Card, CardContent,
  Divider, Alert, Chip, CircularProgress, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { StatusChip } from '@/components/data/StatusChip';
import { useEffect, useMemo, useState } from 'react';
import { adminApi, type DisputeRow } from '@/lib/api';

type Filter = 'all' | 'refunded' | 'rejected';

export default function DisputeCompletionPage() {
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<DisputeRow | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setRows(await adminApi.getDisputes('completed'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load completed disputes');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'refunded') return rows.filter((r) => r.status === 'refund_completed');
    if (filter === 'rejected') return rows.filter((r) => r.status === 'rejected');
    return rows;
  }, [rows, filter]);

  const refundedTotal = rows
    .filter((r) => r.status === 'refund_completed')
    .reduce((sum, r) => sum + r.amount, 0);

  const columns: GridColDef<DisputeRow>[] = [
    { field: 'id', headerName: 'ID', width: 90, valueFormatter: (value) => String(value).slice(0, 8) },
    { field: 'tripId', headerName: 'Trip', width: 90, valueFormatter: (value) => value ?? '—' },
    { field: 'raiserName', headerName: 'Raised By', width: 160 },
    { field: 'category', headerName: 'Category', width: 150, valueFormatter: (value) => String(value).replace(/_/g, ' ') },
    { field: 'amount', headerName: 'Amount (RM)', width: 110, type: 'number', valueFormatter: (value) => (value ? Number(value).toFixed(2) : '—') },
    { field: 'status', headerName: 'Outcome', width: 130, renderCell: ({ value }) => <StatusChip status={value as string} /> },
    { field: 'refundRef', headerName: 'Ref', width: 120, valueFormatter: (value) => value ?? '—' },
    { field: 'resolvedAt', headerName: 'Closed', width: 170, valueFormatter: (value) => (value ? new Date(value as string).toLocaleString() : '—') },
    { field: 'actions', headerName: '', width: 80, sortable: false, renderCell: ({ row }) => <Button size="small" onClick={() => setSelected(row)}>View</Button> },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={0.5}>Dispute Completion</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Closed disputes — refunded or rejected. Total refunded: <strong>RM {refundedTotal.toFixed(2)}</strong>
      </Typography>

      <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)} sx={{ mb: 2 }}>
        <ToggleButton value="all">All ({rows.length})</ToggleButton>
        <ToggleButton value="refunded">Refunded</ToggleButton>
        <ToggleButton value="rejected">Rejected</ToggleButton>
      </ToggleButtonGroup>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ height: 460 }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}><CircularProgress /></Stack>
        ) : (
          <DataGrid rows={filtered} columns={columns} pageSizeOptions={[25]} disableRowSelectionOnClick />
        )}
      </Box>

      <Drawer anchor="right" open={!!selected} onClose={() => setSelected(null)} PaperProps={{ sx: { width: 380, p: 3 } }}>
        {selected && (
          <>
            <Typography variant="subtitle1" fontWeight={700} mb={1}>Dispute Detail</Typography>
            <Divider sx={{ mb: 2 }} />
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent sx={{ p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                  <Chip label={selected.raisedBy} size="small" color={selected.raisedBy === 'rider' ? 'info' : 'secondary'} />
                  <StatusChip status={selected.status} />
                </Stack>
                <Typography variant="body2" fontWeight={600} textTransform="capitalize">{selected.category.replace(/_/g, ' ')}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Trip {selected.tripId ?? '—'} · {selected.raiserName}
                </Typography>
                {selected.amount > 0 && <Typography variant="body2" mt={0.5}>Amount: <strong>RM {selected.amount.toFixed(2)}</strong>{selected.refundRef ? ` · ${selected.refundRef}` : ''}</Typography>}
                <Divider sx={{ my: 1 }} />
                <Typography variant="body2">{selected.description}</Typography>
                {selected.resolutionNote && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="text.secondary">Resolution</Typography>
                    <Typography variant="body2">{selected.resolutionNote}</Typography>
                  </>
                )}
                {selected.refundNote && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="text.secondary">Refund note</Typography>
                    <Typography variant="body2">{selected.refundNote}</Typography>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </Drawer>
    </Box>
  );
}
