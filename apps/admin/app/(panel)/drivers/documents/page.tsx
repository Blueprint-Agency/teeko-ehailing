'use client';
import {
  Box, Typography, Chip, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, Stack, CircularProgress,
  Accordion, AccordionSummary, AccordionDetails, Table, TableBody, TableCell,
  TableHead, TableRow, Avatar,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useRbac } from '@/hooks/useRbac';
import { adminApi, resolveFileUrl, type DocReviewRow } from '@/lib/api';
import Link from '@mui/material/Link';
import { useEffect, useMemo, useState } from 'react';

type DriverGroup = {
  driverId: string;
  driverName: string;
  docs: DocReviewRow[];
  pending: number;
};

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

  const groups = useMemo<DriverGroup[]>(() => {
    const byDriver = new Map<string, DriverGroup>();
    for (const row of rows) {
      let g = byDriver.get(row.driverId);
      if (!g) {
        g = { driverId: row.driverId, driverName: row.driverName, docs: [], pending: 0 };
        byDriver.set(row.driverId, g);
      }
      g.docs.push(row);
      if (row.status === 'pending') g.pending += 1;
    }
    return [...byDriver.values()].sort(
      (a, b) => b.pending - a.pending || a.driverName.localeCompare(b.driverName),
    );
  }, [rows]);

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Document Review Queue</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
          <CircularProgress />
        </Box>
      ) : groups.length === 0 ? (
        <Typography color="text.secondary">No documents to review.</Typography>
      ) : (
        <Stack spacing={1}>
          {groups.map((group) => (
            <Accordion key={group.driverId} defaultExpanded={group.pending > 0} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1, pr: 2 }}>
                  <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                    {group.driverName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography fontWeight={600}>{group.driverName}</Typography>
                  <Box sx={{ flex: 1 }} />
                  {group.pending > 0 && (
                    <Chip label={`${group.pending} pending`} size="small" color="warning" />
                  )}
                  <Chip label={`${group.docs.length} ${group.docs.length === 1 ? 'doc' : 'docs'}`} size="small" variant="outlined" />
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Category</TableCell>
                      <TableCell>Document</TableCell>
                      <TableCell>Uploaded</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.docs.map((row) => {
                      const href = resolveFileUrl(row.fileUrl);
                      return (
                        <TableRow key={row.documentId} hover>
                          <TableCell>{row.category}</TableCell>
                          <TableCell>
                            {href ? (
                              <Link component="button" type="button" onClick={() => setViewer({ open: true, row })} underline="hover" textAlign="left">{row.docType}</Link>
                            ) : (
                              row.docType
                            )}
                          </TableCell>
                          <TableCell>{row.uploadedAt ? new Date(row.uploadedAt).toLocaleString() : '—'}</TableCell>
                          <TableCell>
                            <Chip label={row.status} size="small" color={row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'error' : 'warning'} />
                          </TableCell>
                          <TableCell align="right">
                            {can('approve_driver') && row.status === 'pending' ? (
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                <Button size="small" color="success" variant="outlined" onClick={() => setDialog({ open: true, row, action: 'approve' })}>Approve</Button>
                                <Button size="small" color="error" variant="outlined" onClick={() => setDialog({ open: true, row, action: 'reject' })}>Reject</Button>
                              </Stack>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}
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
