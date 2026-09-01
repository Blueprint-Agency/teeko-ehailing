'use client';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

import {
  PROFILE_CHANGE_FIELD_LABELS,
  adminApi,
  type ProfileChangeRequest,
} from '@/lib/api';

// One driver's profile-change history, pending items first.
//
// A driver's name and phone sit behind their PSV-D and the APAD/JPJ operator
// record, so the driver app can only *request* a change to them. Approving here
// writes the value onto the account and starts that field's 30-day cooldown;
// rejecting costs the driver nothing and needs a reason they can read in-app.
export function ProfileChangeReview({ driverId }: { driverId: string }) {
  const [requests, setRequests] = useState<ProfileChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [dialog, setDialog] = useState<{
    request: ProfileChangeRequest;
    decision: 'approve' | 'reject';
  } | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // No status filter: the driver's own page shows the whole trail, which is
      // what an auditor asking "when did this name change?" needs.
      const res = await adminApi.getProfileChanges({ driverId, status: 'all' });
      setRequests(res.requests);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile changes');
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!dialog) return;
    setSubmitting(true);
    setError('');
    try {
      await adminApi.reviewProfileChange(dialog.request.id, dialog.decision, note.trim());
      setDone(
        dialog.decision === 'approve'
          ? 'Change approved and applied to the driver’s account.'
          : 'Change rejected. The driver has been notified.',
      );
      setDialog(null);
      setNote('');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to review change';
      // The number was claimed by someone else between submission and review.
      setError(
        message.includes('phone_taken')
          ? 'That number now belongs to another account — reject this request instead.'
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const history = requests.filter((r) => r.status !== 'pending');

  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Profile Change Requests
          </Typography>
          {pending.length > 0 && (
            <Chip label={`${pending.length} pending`} size="small" color="warning" />
          )}
        </Box>

        {done && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>
            {done}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : requests.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            This driver has never requested a profile change.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Field</TableCell>
                <TableCell>Current</TableCell>
                <TableCell>Requested</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...pending, ...history].map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Typography variant="caption">
                      {PROFILE_CHANGE_FIELD_LABELS[r.field] ?? r.field}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {r.currentValue || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" fontWeight={600}>
                      {r.requestedValue}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(r.createdAt).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={r.status}
                      size="small"
                      color={
                        r.status === 'pending'
                          ? 'warning'
                          : r.status === 'approved'
                            ? 'success'
                            : 'default'
                      }
                    />
                    {r.reviewNote && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {r.reviewNote}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {r.status === 'pending' ? (
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => {
                            setNote('');
                            setDialog({ request: r, decision: 'approve' });
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            setNote('');
                            setDialog({ request: r, decision: 'reject' });
                          }}
                        >
                          Reject
                        </Button>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        {r.reviewedByName ?? '—'}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog
        open={!!dialog}
        onClose={() => !submitting && setDialog(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {dialog?.decision === 'approve' ? 'Approve change' : 'Reject change'}
        </DialogTitle>
        <DialogContent>
          {dialog && (
            <Typography variant="body2" mb={2}>
              {PROFILE_CHANGE_FIELD_LABELS[dialog.request.field] ?? dialog.request.field}:{' '}
              <strong>{dialog.request.currentValue || '—'}</strong> →{' '}
              <strong>{dialog.request.requestedValue}</strong>
              {dialog.decision === 'approve'
                ? '. Approving applies this to the account and locks the field for 30 days.'
                : '. The driver sees this reason in the app and can submit again straight away.'}
            </Typography>
          )}
          <TextField
            label={dialog?.decision === 'reject' ? 'Reason (required)' : 'Note (optional)'}
            fullWidth
            multiline
            rows={2}
            size="small"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={dialog?.decision === 'reject' ? 'error' : 'primary'}
            onClick={submit}
            disabled={submitting || (dialog?.decision === 'reject' && !note.trim())}
          >
            {submitting ? 'Saving…' : dialog?.decision === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
