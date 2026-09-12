'use client';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Link as MuiLink, MenuItem, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import NextLink from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import {
  PROFILE_CHANGE_FIELD_LABELS,
  adminApi,
  type ProfileChangeRequest,
  type ProfileChangeRole,
  type ProfileChangeStatus,
} from '@/lib/api';

// The whole name/phone review queue, riders and drivers together.
//
// Renamed off the drivers-only view when riders gained the early-phone-change
// request: a rider writes their own number, but a second change inside 30 days
// has to be approved here. A driver's name and phone sit behind their PSV-D and
// the APAD/JPJ operator record, so *every* driver edit lands here.
//
// Approving writes the value onto the account and restarts the 30-day clock;
// rejecting costs the user nothing and needs a reason they can read in-app.

const STATUS_COLOR: Record<ProfileChangeStatus, 'warning' | 'success' | 'default'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'default',
  cancelled: 'default',
};

export default function ProfileChangesPage() {
  const [requests, setRequests] = useState<ProfileChangeRequest[]>([]);
  const [status, setStatus] = useState<ProfileChangeStatus | 'all'>('pending');
  const [role, setRole] = useState<ProfileChangeRole | 'all'>('all');
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
      const res = await adminApi.getProfileChanges({ status, role });
      setRequests(res.requests);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile changes');
    } finally {
      setLoading(false);
    }
  }, [status, role]);

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
          ? 'Change approved and applied to the account.'
          : 'Change rejected. The user has been notified.',
      );
      setDialog(null);
      setNote('');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to review change';
      // Numbers are deliberately not unique, so a collision is never the
      // problem here — only a per-role rule that has tightened since the
      // request was raised.
      setError(
        message.includes('phone_country_not_allowed')
          ? 'That number is no longer valid for this role — reject this request instead.'
          : message.includes('phone_invalid')
            ? 'That number no longer passes validation — reject this request instead.'
            : message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        Profile Changes
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Name and phone changes awaiting review. Approving applies the value and
        restarts the 30-day clock; rejecting leaves the clock untouched.
      </Typography>

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

      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} mb={2}>
            <TextField
              select
              size="small"
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProfileChangeStatus | 'all')}
              sx={{ minWidth: 140 }}
            >
              {(['pending', 'approved', 'rejected', 'cancelled', 'all'] as const).map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as ProfileChangeRole | 'all')}
              sx={{ minWidth: 140 }}
            >
              {(['all', 'rider', 'driver'] as const).map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : requests.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              Nothing here. No {status === 'all' ? '' : `${status} `}requests
              {role === 'all' ? '' : ` from ${role}s`}.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Field</TableCell>
                  <TableCell>Before → After</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <MuiLink
                          component={NextLink}
                          href={r.role === 'driver' ? `/drivers/${r.userId}` : `/riders/${r.userId}`}
                          underline="hover"
                          variant="caption"
                          fontWeight={600}
                        >
                          {r.userName || r.userEmail || r.userId}
                        </MuiLink>
                        <Chip
                          label={r.role}
                          size="small"
                          variant="outlined"
                          color={r.role === 'driver' ? 'primary' : 'default'}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {PROFILE_CHANGE_FIELD_LABELS[r.field] ?? r.field}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {r.currentValue || '—'}
                      </Typography>
                      <Typography variant="caption" fontWeight={600} display="block">
                        → {r.requestedValue}
                      </Typography>
                      {r.isEarly && (
                        <Box sx={{ mt: 0.5 }}>
                          {/* Not a rejection: the reviewer is being asked to
                              override a cooldown, so show how early it is. */}
                          <Chip
                            label={`⚠️ Early${
                              r.phoneChangedAt
                                ? ` · last changed ${new Date(r.phoneChangedAt).toLocaleDateString()}`
                                : ''
                            }`}
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                          {r.reason && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              “{r.reason}”
                            </Typography>
                          )}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {new Date(r.createdAt).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={r.status} size="small" color={STATUS_COLOR[r.status]} />
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
      </Card>

      <Dialog open={!!dialog} onClose={() => !submitting && setDialog(null)} maxWidth="xs" fullWidth>
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
                ? '. Approving applies this to the account and restarts the 30-day clock.'
                : '. The user sees this reason in the app; the clock is untouched.'}
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
    </Box>
  );
}
