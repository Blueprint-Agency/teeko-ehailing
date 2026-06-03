'use client';
import {
  Box, Typography, Button, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Stack, Select,
  MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add } from '@mui/icons-material';
import adminUsers from '@/data/mock-admin-users.json';
import { useRbac } from '@/hooks/useRbac';
import { StatusChip } from '@/components/data/StatusChip';
import { ROLE_LABELS } from '@/lib/mock-accounts';
import { useState } from 'react';
import { Chip } from '@mui/material';

export default function AdminUsersPage() {
  const { can } = useRbac();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState('');

  if (!can('manage_admins')) {
    return <Box p={4}><Alert severity="warning">Access restricted — Super Admin only.</Alert></Box>;
  }

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
    { field: 'email', headerName: 'Email', flex: 1.5, minWidth: 200 },
    { field: 'role', headerName: 'Role', width: 130, renderCell: ({ value }) => <Chip label={ROLE_LABELS[value as keyof typeof ROLE_LABELS]} size="small" /> },
    { field: 'status', headerName: 'Status', width: 100, renderCell: ({ value }) => <StatusChip status={value} /> },
    { field: 'lastLogin', headerName: 'Last Login', width: 160, valueFormatter: ({ value }) => new Date(value as string).toLocaleString() },
    { field: 'createdAt', headerName: 'Created', width: 110 },
    {
      field: 'actions', headerName: '', width: 100, sortable: false,
      renderCell: ({ row }) => row.role !== 'super_admin' ? (
        <Button size="small" color="error" variant="outlined" onClick={() => setDone(`${row.name} deactivated.`)}>Deactivate</Button>
      ) : null,
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2.5 }}>
        <Typography variant="h6" fontWeight={700}>Admin Users</Typography>
        <Button startIcon={<Add />} variant="contained" size="small" onClick={() => setOpen(true)}>Add Admin</Button>
      </Box>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      <Box sx={{ height: 400 }}>
        <DataGrid rows={adminUsers} columns={columns} pageSizeOptions={[25]} disableRowSelectionOnClick />
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Admin User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Full Name" fullWidth size="small" />
            <TextField label="Email" type="email" fullWidth size="small" />
            <FormControl fullWidth size="small">
              <InputLabel>Role</InputLabel>
              <Select label="Role" defaultValue="support">
                <MenuItem value="operations">Operations</MenuItem>
                <MenuItem value="support">Support</MenuItem>
                <MenuItem value="finance">Finance</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => { setOpen(false); setDone('Admin user created and invite email sent.'); }}>Create & Invite</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
