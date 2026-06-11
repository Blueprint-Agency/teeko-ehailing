'use client';
import { useState } from 'react';
import { Box, Typography, Chip, Menu, MenuItem, ListItemIcon, Tooltip } from '@mui/material';
import { Check, LockOpen, Lock } from '@mui/icons-material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useDriverStore } from '@/stores/driver';

const EVP_STATUSES = ['not_applied', 'pending', 'approved', 'rejected', 'expired'] as const;

const evpColor = (value: string) =>
  value === 'approved' ? 'success'
  : value === 'rejected' || value === 'expired' ? 'error'
  : value === 'pending' ? 'warning'
  : 'default';

const evpLabel = (value: string) => value.replace('_', ' ');

export default function EvpPage() {
  const drivers = useDriverStore((s) => s.drivers);
  const updateDriverEvp = useDriverStore((s) => s.updateDriverEvp);
  const openDriverAccount = useDriverStore((s) => s.openDriverAccount);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingDriver = drivers.find((d) => d.id === editingId) ?? null;

  const openMenu = (e: React.MouseEvent<HTMLElement>, id: string) => {
    setAnchorEl(e.currentTarget);
    setEditingId(id);
  };
  const closeMenu = () => {
    setAnchorEl(null);
    setEditingId(null);
  };
  const selectStatus = (status: string) => {
    if (editingId) updateDriverEvp(editingId, status);
    closeMenu();
  };

  const rows = drivers.map((d) => ({
    ...d,
    evpExpiry: d.evp === 'approved' ? '2026-12-31' : d.evp === 'expired' ? '2025-12-31' : '—',
  }));

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Driver', flex: 1, minWidth: 180 },
    { field: 'city', headerName: 'City', width: 130 },
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
                onClick={canOpen ? () => openDriverAccount(row.id) : undefined}
                disabled={!canOpen}
                sx={{ cursor: canOpen ? 'pointer' : 'not-allowed' }}
              />
            </span>
          </Tooltip>
        );
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
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
        {EVP_STATUSES.map((status) => (
          <MenuItem
            key={status}
            selected={editingDriver?.evp === status}
            onClick={() => selectStatus(status)}
            sx={{ textTransform: 'capitalize' }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              {editingDriver?.evp === status && <Check fontSize="small" />}
            </ListItemIcon>
            {evpLabel(status)}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
