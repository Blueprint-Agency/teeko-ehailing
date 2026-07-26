'use client';
import { Box, Typography, Button, Alert, CircularProgress } from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useDriverStore } from '@/stores/driver';
import { StatusChip } from '@/components/data/StatusChip';

export default function DriversPage() {
  const drivers = useDriverStore((s) => s.drivers);
  const loading = useDriverStore((s) => s.loading);
  const error = useDriverStore((s) => s.error);
  const loadDrivers = useDriverStore((s) => s.loadDrivers);
  const router = useRouter();

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

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
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ height: 600 }}>
        {loading && drivers.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={drivers}
            columns={columns}
            loading={loading}
            pageSizeOptions={[25, 50, 100]}
            checkboxSelection
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
            slotProps={{ toolbar: { showQuickFilter: true } }}
            onRowDoubleClick={({ row }) => router.push(`/drivers/${row.id}`)}
          />
        )}
      </Box>
    </Box>
  );
}
