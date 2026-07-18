'use client';
import {
  Box, Typography, Button, Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, TextField, Stack, Select,
  MenuItem, FormControl, InputLabel, Chip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Add } from '@mui/icons-material';
import { useEffect, useState } from 'react';
import { useRbac } from '@/hooks/useRbac';
import { StatusChip } from '@/components/data/StatusChip';
import { useAdminUsersStore, type AdminUser } from '@/stores/admin';
import type { AdminUserRole } from '@/lib/api';

const ROLE_LABELS: Record<AdminUserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
};

export default function AdminUsersPage() {
  const { can } = useRbac();
  const admins = useAdminUsersStore((s) => s.admins);
  const loading = useAdminUsersStore((s) => s.loading);
  const error = useAdminUsersStore((s) => s.error);
  const loadAdmins = useAdminUsersStore((s) => s.loadAdmins);
  const createAdmin = useAdminUsersStore((s) => s.createAdmin);
  const deactivateAdmin = useAdminUsersStore((s) => s.deactivateAdmin);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; email: string; role: AdminUserRole }>({
    name: '', email: '', role: 'admin',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState('');

  const allowed = can('manage_admins');

  useEffect(() => {
    if (allowed) loadAdmins();
  }, [allowed, loadAdmins]);

  if (!allowed) {
    return <Box p={4}><Alert severity="warning">Access restricted — Super Admin only.</Alert></Box>;
  }

  const openCreate = () => {
    setForm({ name: '', email: '', role: 'admin' });
    setFormError('');
    setOpen(true);
  };

  const submitCreate = async () => {
    setSubmitting(true);
    setFormError('');
    try {
      await createAdmin({ name: form.name.trim(), email: form.email.trim(), role: form.role });
      setOpen(false);
      setDone('Admin user created and invite email sent.');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create admin user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (admin: AdminUser) => {
    try {
      await deactivateAdmin(admin.id);
      setDone(`${admin.name} deactivated.`);
    } catch (e) {
      setDone('');
      setFormError(e instanceof Error ? e.message : 'Failed to deactivate admin');
    }
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
    { field: 'email', headerName: 'Email', flex: 1.5, minWidth: 200 },
    { field: 'role', headerName: 'Role', width: 130, renderCell: ({ value }) => <Chip label={ROLE_LABELS[value as AdminUserRole] ?? value} size="small" /> },
    { field: 'status', headerName: 'Status', width: 100, renderCell: ({ value }) => <StatusChip status={value} /> },
    { field: 'lastLogin', headerName: 'Last Login', width: 160, valueFormatter: (value) => value ? new Date(value as string).toLocaleString() : '—' },
    { field: 'createdAt', headerName: 'Created', width: 110, valueFormatter: (value) => (value as string) ?? '—' },
    {
      field: 'actions', headerName: '', width: 120, sortable: false, filterable: false,
      renderCell: ({ row }) => row.role !== 'super_admin' && row.status !== 'inactive' ? (
        <Button size="small" color="error" variant="outlined" onClick={() => handleDeactivate(row)}>Deactivate</Button>
      ) : null,
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2.5 }}>
        <Typography variant="h6" fontWeight={700}>Admin Users</Typography>
        <Button startIcon={<Add />} variant="contained" size="small" onClick={openCreate}>Add Admin</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      <Box sx={{ height: 400 }}>
        {loading && admins.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid rows={admins} columns={columns} loading={loading} pageSizeOptions={[25]} disableRowSelectionOnClick />
        )}
      </Box>

      <Dialog open={open} onClose={() => !submitting && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Admin User</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Full Name" required autoFocus fullWidth size="small" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label="Email" type="email" required fullWidth size="small" value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Role</InputLabel>
              <Select
                label="Role" value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AdminUserRole }))}
              >
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="super_admin">Super Admin</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submitCreate}
            disabled={submitting || !form.name.trim() || !form.email.trim()}
          >
            {submitting ? 'Creating…' : 'Create & Invite'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
