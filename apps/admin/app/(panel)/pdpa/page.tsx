'use client';
import {
  Box, Typography, Grid, Card, CardContent, Button, Alert, Stack, Chip,
  Table, TableBody, TableRow, TableCell, TableHead, CircularProgress,
  TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import { useRbac } from '@/hooks/useRbac';
import { useCallback, useEffect, useState } from 'react';
import {
  adminApi, type ConsentRow, type ConsentType, type DsrRow,
} from '@/lib/api';

const KIND_COLOR: Record<string, 'info' | 'error' | 'warning'> = {
  access: 'info', erasure: 'error', correction: 'warning',
};
const STATUS_COLOR: Record<string, 'default' | 'info' | 'success'> = {
  received: 'default', processing: 'info', fulfilled: 'success', denied: 'default',
};
const CONSENT_TYPES: ConsentType[] = ['marketing', 'pdpa', 'tnc', 'driver_agreement'];

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Days-to-deadline chip for the statutory 21-day (PDPA s.29/s.36) response window.
function SlaChip({ dsr }: { dsr: DsrRow }) {
  if (dsr.status === 'fulfilled' || dsr.status === 'denied') {
    return <Chip label="closed" size="small" variant="outlined" />;
  }
  const days = Math.ceil((new Date(dsr.dueAt).getTime() - Date.now()) / 86_400_000);
  const overdue = days < 0;
  return (
    <Chip
      label={overdue ? `${-days}d overdue` : `${days}d left`}
      size="small"
      color={overdue ? 'error' : days <= 5 ? 'warning' : 'default'}
    />
  );
}

export default function PdpaPage() {
  const { can } = useRbac();

  const [dsrs, setDsrs] = useState<DsrRow[]>([]);
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // id/action currently running

  // Ad-hoc tools
  const [exportUid, setExportUid] = useState('');
  const [wdUid, setWdUid] = useState('');
  const [wdType, setWdType] = useState<ConsentType>('marketing');

  // Erasure confirmation
  const [eraseTarget, setEraseTarget] = useState<DsrRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, c] = await Promise.all([adminApi.getDsrs(), adminApi.getConsents()]);
      setDsrs(d);
      setConsents(c);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load PDPA tools');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (can('pdpa_tools')) load();
  }, [can, load]);

  if (!can('pdpa_tools')) {
    return <Box p={4}><Alert severity="warning">Access restricted — Super Admin only.</Alert></Box>;
  }

  async function fulfil(dsr: DsrRow) {
    setBusy(dsr.id);
    setError('');
    try {
      const res = await adminApi.fulfilDsr(dsr.id);
      if (res.kind === 'access') {
        downloadJson(`sar-${dsr.name.replace(/\s+/g, '_')}-${dsr.userId.slice(0, 8)}.json`, res.export.data);
        setDone(`Access export generated for ${dsr.name}.`);
      } else if (res.kind === 'erasure') {
        const until = res.report.retainedUntil ? new Date(res.report.retainedUntil).toLocaleDateString() : 'n/a';
        setDone(`${dsr.name} anonymised. Retained records kept until ${until}.`);
      } else {
        setDone(`Correction request for ${dsr.name} closed.`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fulfilment failed');
    } finally {
      setBusy(null);
      setEraseTarget(null);
    }
  }

  async function deny(dsr: DsrRow) {
    setBusy(dsr.id);
    try {
      await adminApi.setDsrStatus(dsr.id, 'denied');
      setDone(`Request from ${dsr.name} denied.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  async function adHocExport() {
    if (!exportUid.trim()) return;
    setBusy('export');
    setError('');
    try {
      const data = await adminApi.exportUser(exportUid.trim());
      downloadJson(`sar-${exportUid.trim().slice(0, 8)}.json`, data);
      setDone(`SAR export downloaded for ${exportUid.trim()}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  }

  async function withdraw() {
    if (!wdUid.trim()) return;
    setBusy('withdraw');
    setError('');
    try {
      await adminApi.withdrawConsent(wdUid.trim(), wdType);
      setDone(`${wdType} consent withdrawn for ${wdUid.trim()}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Withdrawal failed');
    } finally {
      setBusy(null);
    }
  }

  const actionable = (s: DsrRow['status']) => s === 'received' || s === 'processing';

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>PDPA Tools</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      ) : (
      <Grid container spacing={2}>
        {/* Data Subject Requests */}
        <Grid item xs={12}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={0.25}>Data Subject Requests</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                Access (s.30), correction (s.34) and erasure. Statutory response window: 21 days.
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Subject</TableCell>
                    <TableCell>Kind</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>SLA</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dsrs.length === 0 && (
                    <TableRow><TableCell colSpan={5}><Typography variant="body2" color="text.secondary">No requests.</Typography></TableCell></TableRow>
                  )}
                  {dsrs.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{d.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{d.type} · {d.userId.slice(0, 8)}</Typography>
                      </TableCell>
                      <TableCell><Chip label={d.kind} size="small" color={KIND_COLOR[d.kind]} /></TableCell>
                      <TableCell><Chip label={d.status} size="small" color={STATUS_COLOR[d.status] ?? 'default'} /></TableCell>
                      <TableCell><SlaChip dsr={d} /></TableCell>
                      <TableCell align="right">
                        {actionable(d.status) ? (
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                              size="small"
                              variant="outlined"
                              color={d.kind === 'erasure' ? 'error' : 'primary'}
                              disabled={busy === d.id}
                              onClick={() => (d.kind === 'erasure' ? setEraseTarget(d) : fulfil(d))}
                            >
                              {d.kind === 'access' ? 'Export' : d.kind === 'erasure' ? 'Erase' : 'Fulfil'}
                            </Button>
                            <Button size="small" color="inherit" disabled={busy === d.id} onClick={() => deny(d)}>Deny</Button>
                          </Stack>
                        ) : (
                          d.exportPath && <Typography variant="caption" color="text.secondary">{d.exportPath}</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* Ad-hoc SAR export */}
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={0.5}>SAR Export</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Subject Access Request — download all personal data held for a user as JSON.
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small" fullWidth label="User ID"
                  value={exportUid} onChange={(e) => setExportUid(e.target.value)}
                />
                <Button variant="outlined" disabled={!exportUid.trim() || busy === 'export'} onClick={adHocExport}>
                  Download
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Consent withdrawal */}
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={0.5}>Record Consent Withdrawal</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                s.38 withdraw / s.43 direct-marketing opt-out.
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small" fullWidth label="User ID"
                  value={wdUid} onChange={(e) => setWdUid(e.target.value)}
                />
                <TextField
                  size="small" select label="Type" sx={{ minWidth: 140 }}
                  value={wdType} onChange={(e) => setWdType(e.target.value as ConsentType)}
                >
                  {CONSENT_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </TextField>
                <Button variant="outlined" color="warning" disabled={!wdUid.trim() || busy === 'withdraw'} onClick={withdraw}>
                  Withdraw
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Consent log */}
        <Grid item xs={12}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Consent Log</Typography>
              <Table size="small">
                <TableBody>
                  {consents.length === 0 && (
                    <TableRow><TableCell colSpan={4}><Typography variant="body2" color="text.secondary">No consent events.</Typography></TableCell></TableRow>
                  )}
                  {consents.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell><Typography variant="caption">{c.name}</Typography></TableCell>
                      <TableCell><Typography variant="caption" color="text.secondary">{c.consentType}</Typography></TableCell>
                      <TableCell><Chip label={c.granted ? 'granted' : 'withdrawn'} size="small" color={c.granted ? 'success' : 'error'} /></TableCell>
                      <TableCell><Typography variant="caption">{new Date(c.at).toLocaleString()}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      )}

      {/* Erasure confirmation — anonymisation is effectively irreversible */}
      <Dialog open={!!eraseTarget} onClose={() => setEraseTarget(null)}>
        <DialogTitle>Erase {eraseTarget?.name}?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            This <strong>anonymises</strong> the profile (name, phone, email, credentials) and purges
            contact/device data. It does <strong>not</strong> delete trips, payments, disputes or insurance —
            those are retained de-identified to meet tax/APAD retention duties. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEraseTarget(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={busy === eraseTarget?.id}
            onClick={() => eraseTarget && fulfil(eraseTarget)}
          >
            Erase
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
