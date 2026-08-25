'use client';
import { Box, Typography, Button, Alert, CircularProgress } from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDriverStore } from '@/stores/driver';
import { StatusChip } from '@/components/data/StatusChip';
import {
  PROFILE_CHANGE_FIELD_LABELS,
  adminApi,
  type ProfileChangeRequest,
} from '@/lib/api';

export default function DriversPage() {
  const drivers = useDriverStore((s) => s.drivers);
  const loading = useDriverStore((s) => s.loading);
  const error = useDriverStore((s) => s.error);
  const loadDrivers = useDriverStore((s) => s.loadDrivers);
  const router = useRouter();

  const [pendingChanges, setPendingChanges] = useState<ProfileChangeRequest[]>([]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  useEffect(() => {
    // Best-effort: a failed queue fetch must not hide the drivers table.
    adminApi
      .getProfileChanges({ status: 'pending' })
      .then((res) => setPendingChanges(res.requests))
      .catch(() => setPendingChanges([]));
  }, []);

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

      {/* Name/phone edits wait on review before they touch the account, so the
          queue has to be visible from the list — nobody goes driver by driver. */}
      {pendingChanges.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={600} mb={0.5}>
            {pendingChanges.length} profile change
            {pendingChanges.length === 1 ? '' : 's'} waiting for review
          </Typography>
          {pendingChanges.slice(0, 5).map((r) => (
            <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption">
                {r.driverName ?? r.driverId} —{' '}
                {PROFILE_CHANGE_FIELD_LABELS[r.field] ?? r.field}: {r.currentValue || '—'} →{' '}
                <strong>{r.requestedValue}</strong>
              </Typography>
              <Button size="small" onClick={() => router.push(`/drivers/${r.driverId}`)}>
                Review
              </Button>
            </Box>
          ))}
          {pendingChanges.length > 5 && (
            <Typography variant="caption" color="text.secondary">
              and {pendingChanges.length - 5} more — open a driver to review.
            </Typography>
          )}
        </Alert>
      )}
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
