'use client';
import { Box, Typography, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useDriverStore } from '@/stores/driver';

export default function EvpPage() {
  const drivers = useDriverStore((s) => s.drivers);

  const rows = drivers.map((d) => ({
    ...d,
    evpExpiry: d.evp === 'approved' ? '2026-12-31' : d.evp === 'expired' ? '2025-12-31' : '—',
  }));

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Driver', flex: 1, minWidth: 180 },
    { field: 'city', headerName: 'City', width: 130 },
    { field: 'category', headerName: 'Category', width: 100 },
    {
      field: 'evp', headerName: 'EVP Status', width: 130,
      renderCell: ({ value }) => {
        const color = value === 'approved' ? 'success' : value === 'expired' ? 'error' : value === 'pending' ? 'warning' : 'default';
        return <Chip label={value.replace('_', ' ')} size="small" color={color as never} />;
      },
    },
    { field: 'evpExpiry', headerName: 'Expiry Date', width: 120 },
    { field: 'trips', headerName: 'Trips', width: 80, type: 'number' },
    { field: 'joinDate', headerName: 'Joined', width: 110 },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>EVP Application Tracker</Typography>
      <Box sx={{ height: 550 }}>
        <DataGrid rows={rows} columns={columns} pageSizeOptions={[25, 50]} disableRowSelectionOnClick />
      </Box>
    </Box>
  );
}
