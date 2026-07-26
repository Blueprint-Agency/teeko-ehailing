'use client';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRiderStore } from '@/stores/rider';
import { StatusChip } from '@/components/data/StatusChip';

export default function RidersPage() {
  const riders = useRiderStore((s) => s.riders);
  const loading = useRiderStore((s) => s.loading);
  const error = useRiderStore((s) => s.error);
  const loadRiders = useRiderStore((s) => s.loadRiders);
  const createRider = useRiderStore((s) => s.createRider);
  const router = useRouter();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadRiders();
  }, [loadRiders]);

  const openCreate = () => {
    setForm({ name: '', phone: '', email: '' });
    setFormError('');
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    setSubmitting(true);
    setFormError('');
    try {
      await createRider({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
      });
      setCreateOpen(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create rider');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1.5, minWidth: 160 },
    { field: 'phone', headerName: 'Phone', width: 140 },
    { field: 'city', headerName: 'City', width: 120 },
    { field: 'status', headerName: 'Status', width: 100, renderCell: ({ value }) => <StatusChip status={value} /> },
    { field: 'trips', headerName: 'Trips', width: 80, type: 'number' },
    { field: 'totalSpent', headerName: 'Total Spent', width: 110, type: 'number', valueFormatter: ({ value }) => (value == null ? '—' : `RM ${value}`) },
    { field: 'escalation', headerName: 'Escalation Lvl', width: 120, type: 'number' },
    { field: 'rating', headerName: 'Rating', width: 80, type: 'number' },
    { field: 'joinDate', headerName: 'Joined', width: 110 },
    {
      field: 'actions',
      headerName: '',
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ height: '100%' }}>
          <Button size="small" onClick={() => router.push(`/riders/${row.id}`)}>View</Button>
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
        <Typography variant="h6" fontWeight={700}>Riders</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Create Rider
        </Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box sx={{ height: 600 }}>
        {loading && riders.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid
            rows={riders} columns={columns} loading={loading}
            pageSizeOptions={[25, 50]} checkboxSelection disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
            onRowDoubleClick={({ row }) => router.push(`/riders/${row.id}`)}
          />
        )}
      </Box>

      <Dialog open={createOpen} onClose={() => !submitting && setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Create Rider</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name" required autoFocus fullWidth value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <TextField
              label="Phone" fullWidth value={form.phone} placeholder="+60..."
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <TextField
              label="Email" type="email" fullWidth value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={submitting}>Cancel</Button>
          <Button
            variant="contained"
            onClick={submitCreate}
            disabled={submitting || !form.name.trim()}
          >
            {submitting ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
