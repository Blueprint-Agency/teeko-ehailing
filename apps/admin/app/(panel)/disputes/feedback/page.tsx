'use client';
import {
  Box, Typography, Chip, Alert, Stack, CircularProgress, Rating,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useEffect, useState } from 'react';
import { adminApi, type FeedbackRow } from '@/lib/api';

const CATEGORY_COLOR: Record<string, 'default' | 'info' | 'primary' | 'secondary' | 'warning'> = {
  app: 'info',
  driver: 'primary',
  ride: 'secondary',
  payment: 'warning',
  suggestion: 'default',
  other: 'default',
};

export default function FeedbackPage() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setRows(await adminApi.getFeedback());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load feedback');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const columns: GridColDef<FeedbackRow>[] = [
    { field: 'userName', headerName: 'From', width: 160 },
    { field: 'role', headerName: 'Role', width: 90, renderCell: ({ value }) => <Chip label={value as string} size="small" color={value === 'rider' ? 'info' : 'secondary'} /> },
    { field: 'category', headerName: 'Category', width: 120, renderCell: ({ value }) => <Chip label={value as string} size="small" variant="outlined" color={CATEGORY_COLOR[value as string] ?? 'default'} /> },
    { field: 'rating', headerName: 'Rating', width: 130, renderCell: ({ value }) => value ? <Rating value={value as number} readOnly size="small" /> : <Typography variant="caption" color="text.secondary">—</Typography> },
    { field: 'message', headerName: 'Feedback', flex: 1, minWidth: 260 },
    { field: 'tripId', headerName: 'Trip', width: 90, valueFormatter: (value) => value ?? '—' },
    { field: 'createdAt', headerName: 'Date', width: 170, valueFormatter: (value) => new Date(value as string).toLocaleString() },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Feedback</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Box sx={{ height: 500 }}>
        {loading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}><CircularProgress /></Stack>
        ) : (
          <DataGrid rows={rows} columns={columns} pageSizeOptions={[25]} disableRowSelectionOnClick getRowHeight={() => 'auto'} sx={{ '& .MuiDataGrid-cell': { py: 1 } }} />
        )}
      </Box>
    </Box>
  );
}
