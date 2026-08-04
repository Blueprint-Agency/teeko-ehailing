'use client';
import { Box, Typography, Chip, Alert, CircularProgress, Button } from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { useEffect, useState } from 'react';
import { useRbac } from '@/hooks/useRbac';
import { adminApi, AuditLogEntry } from '@/lib/api';

export default function AuditPage() {
  const { can } = useRbac();

  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    adminApi
      .getAuditLog(500)
      .then((data) => { setRows(data); setError(''); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load audit log'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (!can('view_audit')) {
    return <Box p={4}><Alert severity="warning">Access restricted — Finance or Super Admin only.</Alert></Box>;
  }

  const columns: GridColDef[] = [
    { field: 'date', headerName: 'Date/Time', width: 170, valueFormatter: ({ value }) => new Date(value as string).toLocaleString() },
    { field: 'adminName', headerName: 'Admin', width: 140 },
    { field: 'role', headerName: 'Role', width: 120, renderCell: ({ value }) => <Chip label={value} size="small" /> },
    { field: 'action', headerName: 'Action', width: 170, valueFormatter: ({ value }) => String(value).replace(/_/g, ' ') },
    { field: 'targetName', headerName: 'Target', flex: 1, minWidth: 160 },
    { field: 'details', headerName: 'Details', flex: 2, minWidth: 220 },
    { field: 'ip', headerName: 'IP', width: 120 },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
        <Typography variant="h6" fontWeight={700}>Audit Log</Typography>
        <Button size="small" variant="outlined" onClick={load} disabled={loading}>Refresh</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <Box sx={{ height: 600 }}>
          <DataGrid
            rows={rows} columns={columns}
            pageSizeOptions={[25, 50]} disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
          />
        </Box>
      )}
    </Box>
  );
}
