'use client';
import { Box, Typography, Chip } from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import auditLog from '@/data/mock-audit-log.json';
import { useRbac } from '@/hooks/useRbac';
import { Alert } from '@mui/material';

export default function AuditPage() {
  const { can } = useRbac();
  if (!can('view_audit')) return <Box p={4}><Alert severity="warning">Access restricted — Finance or Super Admin only.</Alert></Box>;

  const columns: GridColDef[] = [
    { field: 'date', headerName: 'Date/Time', width: 170, valueFormatter: ({ value }) => new Date(value as string).toLocaleString() },
    { field: 'adminName', headerName: 'Admin', width: 140 },
    { field: 'role', headerName: 'Role', width: 110, renderCell: ({ value }) => <Chip label={value} size="small" /> },
    { field: 'action', headerName: 'Action', width: 160, valueFormatter: ({ value }) => String(value).replace(/_/g, ' ') },
    { field: 'targetName', headerName: 'Target', flex: 1, minWidth: 160 },
    { field: 'details', headerName: 'Details', flex: 2, minWidth: 200 },
    { field: 'ip', headerName: 'IP', width: 120 },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Audit Log</Typography>
      <Box sx={{ height: 600 }}>
        <DataGrid
          rows={auditLog} columns={columns}
          pageSizeOptions={[25, 50]} disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
        />
      </Box>
    </Box>
  );
}
