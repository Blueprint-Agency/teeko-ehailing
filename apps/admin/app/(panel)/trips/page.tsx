'use client';
import { Box, Typography, Button, Chip } from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { useRouter } from 'next/navigation';
import { useTripStore } from '@/stores/trip';
import { StatusChip } from '@/components/data/StatusChip';

export default function TripHistoryPage() {
  const trips = useTripStore((s) => s.trips);
  const router = useRouter();

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'date', headerName: 'Date/Time', width: 160, valueFormatter: ({ value }) => new Date(value as string).toLocaleString() },
    { field: 'pickup', headerName: 'Pickup', flex: 1, minWidth: 120 },
    { field: 'dropoff', headerName: 'Dropoff', flex: 1, minWidth: 120 },
    { field: 'category', headerName: 'Category', width: 100 },
    { field: 'city', headerName: 'City', width: 120 },
    { field: 'status', headerName: 'Status', width: 120, renderCell: ({ value }) => <StatusChip status={value} /> },
    { field: 'fare', headerName: 'Fare (RM)', width: 100, type: 'number', valueFormatter: ({ value }) => `RM ${Number(value).toFixed(2)}` },
    { field: 'surge', headerName: 'Surge', width: 80, type: 'number', renderCell: ({ value }) => value > 1 ? <Chip label={`${value}×`} size="small" color="warning" /> : <span>—</span> },
    { field: 'paymentMethod', headerName: 'Payment', width: 90 },
    { field: 'dispute', headerName: 'Dispute', width: 80, renderCell: ({ value }) => value ? <Chip label="Yes" size="small" color="error" /> : null },
    { field: 'actions', headerName: '', width: 80, sortable: false, renderCell: ({ row }) => <Button size="small" onClick={() => router.push(`/trips/${row.id}`)}>View</Button> },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Trip History</Typography>
      <Box sx={{ height: 620 }}>
        <DataGrid
          rows={trips} columns={columns}
          pageSizeOptions={[25, 50, 100]} checkboxSelection disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
          onRowDoubleClick={({ row }) => router.push(`/trips/${row.id}`)}
        />
      </Box>
    </Box>
  );
}
