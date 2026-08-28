'use client';
import { Box, Typography, Button, Alert, Tooltip, CircularProgress } from '@mui/material';
import { PendingActions } from '@mui/icons-material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useDriverStore } from '@/stores/driver';
import { StatusChip } from '@/components/data/StatusChip';
import {
  adminApi,
  type ProfileChangeRequest,
} from '@/lib/api';

/** Filter values for the pending-action column — fixed so the grid can offer them. */
const PENDING_ACTION_OPTIONS = ['Profile change', 'None'] as const;

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

  // The queue is keyed by driver so the list can flag which rows need a decision.
  const pendingDriverIds = useMemo(
    () => new Set(pendingChanges.map((r) => r.driverId)),
    [pendingChanges],
  );

  const rows = useMemo(
    () =>
      drivers.map((d) => ({
        ...d,
        pendingAction: pendingDriverIds.has(d.id) ? 'Profile change' : 'None',
      })),
    [drivers, pendingDriverIds],
  );

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
      field: 'pendingAction', headerName: 'Pending Action', width: 130,
      type: 'singleSelect', valueOptions: [...PENDING_ACTION_OPTIONS],
      align: 'center', headerAlign: 'center',
      renderCell: ({ value }) =>
        value === 'None' ? null : (
          <Tooltip title="Waiting for review">
            <PendingActions fontSize="small" color="warning" />
          </Tooltip>
        ),
    },
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
          <Typography variant="body2" fontWeight={600}>
            {pendingChanges.length} profile change
            {pendingChanges.length === 1 ? '' : 's'} waiting for review
          </Typography>
        </Alert>
      )}
      <Box sx={{ height: 600 }}>
        {loading && drivers.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={rows}
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
