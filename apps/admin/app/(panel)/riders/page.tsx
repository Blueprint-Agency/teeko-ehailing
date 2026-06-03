'use client';
import { Box, Typography, Button } from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { useRouter } from 'next/navigation';
import { useRiderStore } from '@/stores/rider';
import { StatusChip } from '@/components/data/StatusChip';

export default function RidersPage() {
  const riders = useRiderStore((s) => s.riders);
  const router = useRouter();

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1.5, minWidth: 160 },
    { field: 'phone', headerName: 'Phone', width: 140 },
    { field: 'city', headerName: 'City', width: 120 },
    { field: 'status', headerName: 'Status', width: 100, renderCell: ({ value }) => <StatusChip status={value} /> },
    { field: 'trips', headerName: 'Trips', width: 80, type: 'number' },
    { field: 'totalSpent', headerName: 'Total Spent', width: 110, type: 'number', valueFormatter: ({ value }) => `RM ${value}` },
    { field: 'escalation', headerName: 'Escalation Lvl', width: 120, type: 'number' },
    { field: 'rating', headerName: 'Rating', width: 80, type: 'number' },
    { field: 'joinDate', headerName: 'Joined', width: 110 },
    { field: 'actions', headerName: '', width: 80, sortable: false, renderCell: ({ row }) => <Button size="small" onClick={() => router.push(`/riders/${row.id}`)}>View</Button> },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Riders</Typography>
      <Box sx={{ height: 600 }}>
        <DataGrid
          rows={riders} columns={columns}
          pageSizeOptions={[25, 50]} checkboxSelection disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
          onRowDoubleClick={({ row }) => router.push(`/riders/${row.id}`)}
        />
      </Box>
    </Box>
  );
}
