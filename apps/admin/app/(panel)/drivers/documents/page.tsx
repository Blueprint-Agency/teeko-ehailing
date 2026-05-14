'use client';
import {
  Box, Typography, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, Stack,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useDriverStore } from '@/stores/driver';
import { useRbac } from '@/hooks/useRbac';
import { useState } from 'react';

const DOC_TYPES = ['IC (Front)', 'IC (Back)', 'Driving Licence', 'Vehicle Registration', 'Vehicle Insurance', 'Vehicle Inspection (JPJ)', 'EVP Certificate'];

interface DocRow {
  id: string; driverId: string; driverName: string; docType: string;
  city: string; category: string; uploadedAt: string; status: string;
}

function generateDocRows(drivers: ReturnType<typeof useDriverStore.getState>['drivers']): DocRow[] {
  const rows: DocRow[] = [];
  drivers
    .filter((d) => d.status === 'pending' || d.evp === 'pending')
    .forEach((d) => {
      DOC_TYPES.slice(0, 5).forEach((dt, i) => {
        rows.push({
          id: `${d.id}_doc${i}`,
          driverId: d.id,
          driverName: d.name,
          docType: dt,
          city: d.city,
          category: d.category,
          uploadedAt: '2026-05-14',
          status: i < 3 ? 'approved' : 'pending',
        });
      });
    });
  return rows;
}

export default function DocumentsPage() {
  const drivers = useDriverStore((s) => s.drivers);
  const { can } = useRbac();
  const rows = generateDocRows(drivers);
  const [dialog, setDialog] = useState<{ open: boolean; row: DocRow | null; action: 'approve' | 'reject' }>({ open: false, row: null, action: 'approve' });
  const [reason, setReason] = useState('');
  const [done, setDone] = useState('');

  const handleAction = () => {
    setDone(`Document ${dialog.action === 'approve' ? 'approved' : 'rejected'} successfully.`);
    setDialog({ open: false, row: null, action: 'approve' });
    setReason('');
  };

  const columns: GridColDef[] = [
    { field: 'driverName', headerName: 'Driver', flex: 1, minWidth: 160 },
    { field: 'city', headerName: 'City', width: 120 },
    { field: 'category', headerName: 'Category', width: 100 },
    { field: 'docType', headerName: 'Document', width: 180 },
    { field: 'uploadedAt', headerName: 'Uploaded', width: 110 },
    {
      field: 'status', headerName: 'Status', width: 110,
      renderCell: ({ value }) => <Chip label={value} size="small" color={value === 'approved' ? 'success' : value === 'rejected' ? 'error' : 'warning'} />,
    },
    {
      field: 'actions', headerName: 'Actions', width: 160, sortable: false,
      renderCell: ({ row }) => can('approve_driver') && row.status === 'pending' ? (
        <Stack direction="row" spacing={0.5}>
          <Button size="small" color="success" variant="outlined" onClick={() => setDialog({ open: true, row, action: 'approve' })}>Approve</Button>
          <Button size="small" color="error" variant="outlined" onClick={() => setDialog({ open: true, row, action: 'reject' })}>Reject</Button>
        </Stack>
      ) : null,
    },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Document Review Queue</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      <Box sx={{ height: 550 }}>
        <DataGrid rows={rows} columns={columns} pageSizeOptions={[25, 50]} disableRowSelectionOnClick />
      </Box>
      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, row: null, action: 'approve' })} maxWidth="xs" fullWidth>
        <DialogTitle>{dialog.action === 'approve' ? 'Approve' : 'Reject'} Document</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            {dialog.row?.docType} — <strong>{dialog.row?.driverName}</strong>
          </Typography>
          {dialog.action === 'reject' && (
            <TextField label="Rejection reason" fullWidth multiline rows={2} size="small" value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog({ open: false, row: null, action: 'approve' })}>Cancel</Button>
          <Button variant="contained" color={dialog.action === 'approve' ? 'success' : 'error'} onClick={handleAction}
            disabled={dialog.action === 'reject' && !reason}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
