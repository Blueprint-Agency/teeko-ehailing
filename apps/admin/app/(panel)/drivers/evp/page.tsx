'use client';
import { useEffect, useState } from 'react';
import {
  Box, Typography, Chip, Menu, MenuItem, ListItemIcon, Tooltip, Alert, CircularProgress,
} from '@mui/material';
import { Check, LockOpen, Lock } from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { adminApi, type EvpRecord } from '@/lib/api';

const EVP_STATUSES = ['not_applied', 'pending', 'approved', 'rejected', 'expired'] as const;

const evpColor = (value: string) =>
  value === 'approved' ? 'success'
  : value === 'rejected' || value === 'expired' ? 'error'
  : value === 'pending' ? 'warning'
  : 'default';

const evpLabel = (value: string) => value.replace('_', ' ');

export default function EvpPage() {
  const [rows, setRows] = useState<EvpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingRecord = rows.find((d) => d.id === editingId) ?? null;

  useEffect(() => {
    adminApi
      .getEvpRecords()
      .then(setRows)
      .catch((e) => setError(e.message ?? 'Failed to load EVP records'))
      .finally(() => setLoading(false));
  }, []);

  const openMenu = (e: React.MouseEvent<HTMLElement>, id: string) => {
    setAnchorEl(e.currentTarget);
    setEditingId(id);
  };
  const closeMenu = () => {
    setAnchorEl(null);
    setEditingId(null);
  };
  const selectStatus = (status: EvpRecord['evp']) => {
    if (editingId) setRows((rs) => rs.map((r) => (r.id === editingId ? { ...r, evp: status } : r)));
    closeMenu();
  };
  const openAccount = (id: string) =>
    setRows((rs) => rs.map((r) => (r.id === id && r.evp === 'approved' ? { ...r, account: 'open' } : r)));

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Driver', flex: 1, minWidth: 180 },
    { field: 'region', headerName: 'Region', width: 200 },
    { field: 'category', headerName: 'Category', width: 100 },
    {
      field: 'evp', headerName: 'EVP Status', width: 150,
      renderCell: ({ value, row }: GridRenderCellParams) => (
        <Chip
          label={evpLabel(value)}
          size="small"
          color={evpColor(value) as never}
          onClick={(e) => openMenu(e, row.id)}
          sx={{ cursor: 'pointer' }}
        />
      ),
    },
    {
      field: 'account', headerName: 'Account', width: 150, sortable: false,
      renderCell: ({ value, row }: GridRenderCellParams) => {
        if (value === 'open') {
          return (
            <Chip
              label="Open"
              size="small"
              color="success"
              icon={<LockOpen fontSize="small" />}
            />
          );
        }
        const canOpen = row.evp === 'approved';
        return (
          <Tooltip title={canOpen ? 'Open account (final onboarding step)' : 'EVP must be approved first'}>
            <span>
              <Chip
                label="Closed"
                size="small"
                color="default"
                icon={<Lock fontSize="small" />}
                onClick={canOpen ? () => openAccount(row.id) : undefined}
                disabled={!canOpen}
                sx={{ cursor: canOpen ? 'pointer' : 'not-allowed' }}
              />
            </span>
          </Tooltip>
        );
      },
    },
    { field: 'evpExpiry', headerName: 'Expiry Date', width: 120, valueGetter: (v) => v ?? '—' },
    { field: 'trips', headerName: 'Trips', width: 80, type: 'number' },
    { field: 'joinDate', headerName: 'Joined', width: 110 },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>EVP Application Tracker</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Box sx={{ height: 550 }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid rows={rows} columns={columns} pageSizeOptions={[25, 50]} disableRowSelectionOnClick />
        )}
      </Box>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
        {EVP_STATUSES.map((status) => (
          <MenuItem
            key={status}
            selected={editingRecord?.evp === status}
            onClick={() => selectStatus(status)}
            sx={{ textTransform: 'capitalize' }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              {editingRecord?.evp === status && <Check fontSize="small" />}
            </ListItemIcon>
            {evpLabel(status)}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
