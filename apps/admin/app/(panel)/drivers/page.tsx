'use client';
import { Box, Typography, Button } from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { useRouter } from 'next/navigation';
import { useDriverStore } from '@/stores/driver';
import { StatusChip } from '@/components/data/StatusChip';

export default function DriversPage() {
  const drivers = useDriverStore((s) => s.drivers);
  const router = useRouter();

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1.5, minWidth: 180 },
    { field: 'city', headerName: 'City', width: 130 },
    { field: 'category', headerName: 'Category', width: 100 },
    {
      field: 'status', headerName: 'Status', width: 110,
      renderCell: ({ value }) => <StatusChip status={value} />,
    },
    {
      field: 'evp', headerName: 'EVP', width: 110,
      renderCell: ({ value }) => <StatusChip status={value} />,
    },
    { field: 'rating', headerName: 'Rating', width: 80, type: 'number' },
    { field: 'trips', headerName: 'Trips', width: 80, type: 'number' },
    { field: 'joinDate', headerName: 'Joined', width: 110 },
    {
      field: 'actions', headerName: '', width: 80, sortable: false,
      renderCell: ({ row }) => (
        <Button size="small" onClick={() => router.push(`/drivers/${row.id}`)}>View</Button>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Drivers</Typography>
      <Box sx={{ height: 600 }}>
        <DataGrid
          rows={drivers}
          columns={columns}
          pageSizeOptions={[25, 50, 100]}
          checkboxSelection
          disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }}
          slotProps={{ toolbar: { showQuickFilter: true } }}
          onRowDoubleClick={({ row }) => router.push(`/drivers/${row.id}`)}
        />
      </Box>
    </Box>
  );
}
