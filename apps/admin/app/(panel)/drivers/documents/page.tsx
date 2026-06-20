'use client';
import {
  Box, Typography, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, Stack, CircularProgress,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useRbac } from '@/hooks/useRbac';
import { adminApi, resolveFileUrl, type DocReviewRow } from '@/lib/api';
import Link from '@mui/material/Link';
import { useEffect, useState } from 'react';

export default function DocumentsPage() {
  const { can } = useRbac();
  const [rows, setRows] = useState<DocReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; row: DocReviewRow | null; action: 'approve' | 'reject' }>({ open: false, row: null, action: 'approve' });
  const [reason, setReason] = useState('');
  const [done, setDone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [viewer, setViewer] = useState<{ open: boolean; row: DocReviewRow | null }>({ open: false, row: null });

  useEffect(() => {
    adminApi
      .getDocumentQueue()
      .then(setRows)
      .catch((e) => setError(e.message ?? 'Failed to load documents'))
      .finally(() => setLoading(false));
  }, []);

  const closeDialog = () => {
    setDialog({ open: false, row: null, action: 'approve' });
    setReason('');
  };

  const handleAction = async () => {
    if (!dialog.row) return;
    const { documentId } = dialog.row;
    const action = dialog.action;
    setSubmitting(true);
    setError('');
    try {
      const res = await adminApi.reviewDocument(documentId, action === 'approve' ? 'approved' : 'rejected', reason || undefined);
      setRows((rs) => rs.map((r) => (r.documentId === documentId ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r)));
      setDone(
        res.evpCreated
          ? 'Document approved — all documents verified, EVP application created.'
          : `Document ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
      );
      closeDialog();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: GridColDef[] = [
    { field: 'driverName', headerName: 'Driver', flex: 1, minWidth: 160 },
    { field: 'category', headerName: 'Category', width: 100 },
    {
      field: 'docType', headerName: 'Document', width: 220,
      renderCell: ({ value, row }) => {
        const href = resolveFileUrl(row.fileUrl);
        return href ? (
          <Link component="button" type="button" onClick={() => setViewer({ open: true, row })} underline="hover" textAlign="left">{value}</Link>
        ) : (
          value
        );
      },
    },
    { field: 'uploadedAt', headerName: 'Uploaded', width: 180, valueGetter: (v) => (v ? new Date(v).toLocaleString() : '—') },
    {
      field: 'status', headerName: 'Status', width: 110,
      renderCell: ({ value }) => <Chip label={value} size="small" color={value === 'approved' ? 'success' : value === 'rejected' ? 'error' : 'warning'} />,
    },
    {
      field: 'actions', headerName: 'Actions', width: 160, sortable: false,
      renderCell: ({ row }) => can('approve_driver') && row.status === 'pending' ? (
        <Stack direction="row" spacing={0.5}>
          <Button size="small" color="success" variant="outlined" onClick={() => setDialog({ open: true, row, action: 'approve' })}>Approve</Button>
          <Button size="small" color="error" variant="outlined" onClick={() => setDialog({ open: true, row, action: 'reject' })}>Reject</Button>
        </Stack>
      ) : null,
    },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Document Review Queue</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Box sx={{ height: 550 }}>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : (
          <DataGrid getRowId={(r) => r.documentId} rows={rows} columns={columns} pageSizeOptions={[25, 50]} disableRowSelectionOnClick />
        )}
      </Box>
      <Dialog open={dialog.open} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{dialog.action === 'approve' ? 'Approve' : 'Reject'} Document</DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            {dialog.row?.docType} — <strong>{dialog.row?.driverName}</strong>
          </Typography>
          {dialog.action === 'reject' && (
            <TextField label="Rejection reason" fullWidth multiline rows={2} size="small" value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>Cancel</Button>
          <Button variant="contained" color={dialog.action === 'approve' ? 'success' : 'error'} onClick={handleAction}
            disabled={submitting || (dialog.action === 'reject' && !reason)}>
            {submitting ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={viewer.open} onClose={() => setViewer({ open: false, row: null })} maxWidth="lg" fullWidth>
        <DialogTitle>
          {viewer.row?.docType} — <strong>{viewer.row?.driverName}</strong>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, bgcolor: 'grey.100' }}>
          {(() => {
            const href = viewer.row ? resolveFileUrl(viewer.row.fileUrl) : null;
            if (!href) return null;
            const isPdf = /\.pdf(\?|$)/i.test(href);
            return isPdf ? (
              <Box component="iframe" src={href} sx={{ width: '100%', height: '70vh', border: 0, display: 'block' }} />
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', p: 2 }}>
                <Box component="img" src={href} alt={viewer.row?.docType} sx={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          {viewer.row && resolveFileUrl(viewer.row.fileUrl) && (
            <Button component={Link} href={resolveFileUrl(viewer.row.fileUrl)!} target="_blank" rel="noopener noreferrer">Open in new tab</Button>
          )}
          <Button onClick={() => setViewer({ open: false, row: null })}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
