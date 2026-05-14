'use client';
import { Box, Typography, Button, Alert, Chip } from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { usePayoutStore } from '@/stores/payout';
import { useRbac } from '@/hooks/useRbac';
import { StatusChip } from '@/components/data/StatusChip';
import { useState } from 'react';

export default function PayoutsPage() {
  const payouts = usePayoutStore((s) => s.payouts);
  const trigger = usePayoutStore((s) => s.triggerPayout);
  const { can } = useRbac();
  const [done, setDone] = useState('');

  const columns: GridColDef[] = [
    { field: 'driverName', headerName: 'Driver', flex: 1, minWidth: 160 },
    { field: 'period', headerName: 'Period', width: 180 },
    { field: 'amount', headerName: 'Amount (RM)', width: 120, type: 'number', valueFormatter: ({ value }) => `RM ${Number(value).toLocaleString()}` },
    { field: 'bank', headerName: 'Bank', width: 100 },
    { field: 'account', headerName: 'Account', width: 100 },
    { field: 'status', headerName: 'Status', width: 110, renderCell: ({ value }) => <StatusChip status={value} /> },
    { field: 'processedAt', headerName: 'Processed', width: 160, valueFormatter: ({ value }) => value ? new Date(value as string).toLocaleString() : '—' },
    {
      field: 'failReason', headerName: 'Fail Reason', width: 150,
      renderCell: ({ value }) => value ? <Chip label={value} size="small" color="error" /> : null,
    },
    {
      field: 'actions', headerName: 'Action', width: 120, sortable: false,
      renderCell: ({ row }) => can('trigger_payout') && (row.status === 'pending' || row.status === 'failed') ? (
        <Button size="small" variant="outlined" onClick={() => { trigger(row.id); setDone(`Payout for ${row.driverName} triggered.`); }}>
          Trigger
        </Button>
      ) : null,
    },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Payout Management</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      <Box sx={{ height: 580 }}>
        <DataGrid
          rows={payouts} columns={columns}
          pageSizeOptions={[25, 50]} checkboxSelection disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
        />
      </Box>
    </Box>
  );
}
