'use client';
import {
  Box, Typography, Button, Alert, Chip, Stack, TextField, ButtonGroup, Paper, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText,
  Table, TableHead, TableBody, TableRow, TableCell, Grid, Card, CardContent, CircularProgress,
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbar, GridRowSelectionModel } from '@mui/x-data-grid';
import { BarChart, LineChart } from '@mui/x-charts';
import { Download } from '@mui/icons-material';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRbac } from '@/hooks/useRbac';
import {
  adminApi,
  RevenueDay,
  PayoutSheetRow,
  PayoutSheetTrip,
  PayoutHistoryRow,
} from '@/lib/api';

const FINANCE_EMAIL = 'finance@teeko.my';

const rm = (n: number) => `RM ${Number(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function csvCell(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(rows: (string | number)[][], filename: string) {
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Trip breakdown shared by both drill-downs: outstanding and already paid. */
function TripTable({ trips, loading }: { trips: PayoutSheetTrip[]; loading: boolean }) {
  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>;
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Date</TableCell>
          <TableCell>Route</TableCell>
          <TableCell>Type</TableCell>
          <TableCell align="right">Fare</TableCell>
          <TableCell align="right">Commission</TableCell>
          <TableCell align="right">Net</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {trips.map((t) => (
          <TableRow key={t.id}>
            <TableCell>{dayjs(t.date).format('DD MMM YYYY, HH:mm')}</TableCell>
            <TableCell>{t.pickup ?? '—'} → {t.dropoff ?? '—'}</TableCell>
            <TableCell><Chip label={t.category} size="small" variant="outlined" /></TableCell>
            <TableCell align="right">{rm(t.fare)}</TableCell>
            <TableCell align="right">{rm(t.commission)}</TableCell>
            <TableCell align="right"><b>{rm(t.net)}</b></TableCell>
          </TableRow>
        ))}
        {trips.length === 0 && (
          <TableRow><TableCell colSpan={6} align="center">No trips to show.</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default function PayoutsPage() {
  const { can } = useRbac();
  const canPay = can('trigger_payout');

  // Revenue Reports data — fetched from the backend (last 30 days).
  const [revenue, setRevenue] = useState<RevenueDay[]>([]);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState('');

  useEffect(() => {
    let alive = true;
    adminApi
      .getRevenueDaily(30)
      .then((data) => { if (alive) { setRevenue(data); setRevenueError(''); } })
      .catch((e) => { if (alive) setRevenueError(e instanceof Error ? e.message : 'Failed to load revenue'); })
      .finally(() => { if (alive) setRevenueLoading(false); });
    return () => { alive = false; };
  }, []);

  const last30 = revenue.slice(-30);
  const last7 = revenue.slice(-7);
  const totalRevenue = last30.reduce((s, d) => s + d.revenue, 0);
  const totalCommissions = last30.reduce((s, d) => s + d.commissions, 0);
  const totalPayouts = last30.reduce((s, d) => s + d.payouts, 0);
  const totalReportTrips = last30.reduce((s, d) => s + d.trips, 0);
  const reportSummary = [
    { label: '30-day Revenue',    value: `RM ${totalRevenue.toLocaleString()}` },
    { label: '30-day Commission', value: `RM ${totalCommissions.toLocaleString()}` },
    { label: '30-day Payouts',    value: `RM ${totalPayouts.toLocaleString()}` },
    { label: '30-day Trips',      value: totalReportTrips.toLocaleString() },
  ];

  // Default to the current month — the usual payout period.
  const MONTH_START = dayjs().startOf('month').format('YYYY-MM-DD');
  const TODAY = dayjs().format('YYYY-MM-DD');

  const [draft, setDraft] = useState({ start: MONTH_START, end: TODAY });
  const [applied, setApplied] = useState({ start: MONTH_START, end: TODAY });
  const [rows, setRows] = useState<PayoutSheetRow[]>([]);
  const [sheetLoading, setSheetLoading] = useState(true);
  const [sheetError, setSheetError] = useState('');
  const [selection, setSelection] = useState<GridRowSelectionModel>([]);
  const [done, setDone] = useState('');
  const [confirm, setConfirm] = useState<{ rows: PayoutSheetRow[]; period: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [tripDriver, setTripDriver] = useState<PayoutSheetRow | null>(null);
  const [modalTrips, setModalTrips] = useState<PayoutSheetTrip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  // Bumped after an export so the sheet refetches — paid rows drop out of it.
  const [reload, setReload] = useState(0);
  const [history, setHistory] = useState<PayoutHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [paidPayout, setPaidPayout] = useState<PayoutHistoryRow | null>(null);
  const [paidTrips, setPaidTrips] = useState<PayoutSheetTrip[]>([]);
  const [paidTripsLoading, setPaidTripsLoading] = useState(false);

  const period = `${applied.start} – ${applied.end}`;

  // The sheet is computed server-side from completed trips + driver_earnings,
  // so every range change is a fetch rather than a client-side re-filter.
  useEffect(() => {
    let alive = true;
    setSheetLoading(true);
    adminApi
      .getPayoutSheet(applied.start, applied.end)
      .then((data) => { if (alive) { setRows(data.rows); setSheetError(''); } })
      .catch((e) => { if (alive) { setRows([]); setSheetError(e instanceof Error ? e.message : 'Failed to load payouts'); } })
      .finally(() => { if (alive) setSheetLoading(false); });
    return () => { alive = false; };
  }, [applied, reload]);

  // Executed payouts for the same range. Refetched after an export, since that
  // is exactly what moves rows from the sheet into this table.
  useEffect(() => {
    let alive = true;
    setHistoryLoading(true);
    adminApi
      .getPayoutHistory(applied.start, applied.end)
      .then((data) => { if (alive) { setHistory(data.rows); setHistoryError(''); } })
      .catch((e) => { if (alive) { setHistory([]); setHistoryError(e instanceof Error ? e.message : 'Failed to load payout history'); } })
      .finally(() => { if (alive) setHistoryLoading(false); });
    return () => { alive = false; };
  }, [applied, reload]);

  // The trips one executed payout covered.
  useEffect(() => {
    if (!paidPayout) return;
    let alive = true;
    setPaidTripsLoading(true);
    setPaidTrips([]);
    adminApi
      .getPayoutTrips(paidPayout.id)
      .then((data) => { if (alive) setPaidTrips(data.trips); })
      .catch(() => { if (alive) setPaidTrips([]); })
      .finally(() => { if (alive) setPaidTripsLoading(false); });
    return () => { alive = false; };
  }, [paidPayout]);

  // Trip log drill-down for one driver, over the applied range.
  useEffect(() => {
    if (!tripDriver) return;
    let alive = true;
    setTripsLoading(true);
    setModalTrips([]);
    adminApi
      .getPayoutSheetTrips(tripDriver.driverId, applied.start, applied.end)
      .then((data) => { if (alive) setModalTrips(data.trips); })
      .catch(() => { if (alive) setModalTrips([]); })
      .finally(() => { if (alive) setTripsLoading(false); });
    return () => { alive = false; };
  }, [tripDriver, applied]);

  const exportRevenueCsv = () => {
    if (revenue.length === 0) return;
    const header = ['Date', 'Trips', 'Revenue (RM)', 'Commission (RM)', 'Payouts (RM)', 'Refunds (RM)'];
    const body = revenue.map((d) => [d.date, d.trips, d.revenue.toFixed(2), d.commissions.toFixed(2), d.payouts.toFixed(2), d.refunds.toFixed(2)]);
    downloadCsv(
      [header, ...body],
      `revenue-report-${revenue[0]?.date ?? 'start'}_to_${revenue[revenue.length - 1]?.date ?? 'end'}.csv`,
    );

    const rangeLabel = `${revenue[0]?.date ?? ''} – ${revenue[revenue.length - 1]?.date ?? ''}`;
    adminApi
      .logAudit({
        action: 'export_report',
        targetName: 'Revenue report',
        details: `Exported revenue report CSV (${revenue.length} days, ${rangeLabel})`,
        payload: { days: revenue.length, range: rangeLabel },
      })
      .catch(() => {});
  };

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const totalTrips = rows.reduce((s, r) => s + r.tripCount, 0);
  const unpayable = rows.filter((r) => !r.hasBankAccount);

  const applyPreset = (unit: 'week' | 'month' | 'year') => {
    const start = dayjs().startOf(unit).format('YYYY-MM-DD');
    const end = dayjs().endOf(unit).format('YYYY-MM-DD');
    setDraft({ start, end });
    setApplied({ start, end });
    setSelection([]);
  };

  const applyRange = () => {
    if (!draft.start || !draft.end) return;
    const [start, end] = draft.start <= draft.end ? [draft.start, draft.end] : [draft.end, draft.start];
    setApplied({ start, end });
    setSelection([]);
  };

  const selectedRows = useMemo(
    () => rows.filter((r) => selection.includes(r.driverId)),
    [rows, selection],
  );

  // Exporting *executes* the payout server-side: it records a payout row per
  // driver and marks the earnings it covers as paid, which is what clears the
  // driver's "pending payout" figure. The rows come back with the real account
  // numbers (the grid only ever holds masked ones) for the transfer file.
  const confirmSubmit = useCallback(async () => {
    if (!confirm) return;
    setExporting(true);
    try {
      const { rows: payable } = await adminApi.exportPayoutSheet(
        applied.start,
        applied.end,
        confirm.rows.map((r) => r.driverId),
      );
      const skipped = confirm.rows.length - payable.length;

      if (payable.length === 0) {
        setDone('');
        setSheetError(
          'Nothing to pay — the selected drivers either have no bank account on file, or their earnings were already paid out.',
        );
        setConfirm(null);
        setReload((n) => n + 1);
        return;
      }

      const header = ['Driver', 'Bank', 'Account Holder', 'Account Number', 'Trips', 'Payout (RM)', 'Period'];
      const body = payable.map((r) => [
        r.driverName, r.bank, r.accountHolderName, r.accountNumber, r.tripCount, r.amount.toFixed(2), confirm.period,
      ]);
      downloadCsv([header, ...body], `payout-sheet-${confirm.period.replace(/[^\w-]+/g, '_')}.csv`);

      const total = payable.reduce((s, r) => s + r.amount, 0);
      // Record the export in the audit trail (best-effort — never block the download).
      adminApi
        .logAudit({
          action: 'export_payout',
          targetName: `Payout sheet — ${confirm.period}`,
          details: `Exported ${payable.length} driver payout(s) — ${rm(total)} — sent to ${FINANCE_EMAIL}`,
          payload: { period: confirm.period, drivers: payable.length, totalRm: Number(total.toFixed(2)) },
        })
        .catch(() => {});

      setSelection([]);
      setConfirm(null);
      setReload((n) => n + 1);
      setDone(
        `Sheet for ${payable.length} driver(s) — ${rm(total)} — exported and sent to ${FINANCE_EMAIL}. ` +
          'These earnings are now marked paid and show as "to bank" in the driver app.' +
          (skipped > 0 ? ` ${skipped} driver(s) skipped — no bank account on file.` : ''),
      );
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : 'Export failed');
      setConfirm(null);
    } finally {
      setExporting(false);
    }
  }, [confirm, applied]);

  const confirmTotal = confirm ? confirm.rows.reduce((s, r) => s + r.amount, 0) : 0;
  const confirmUnpayable = confirm ? confirm.rows.filter((r) => !r.hasBankAccount).length : 0;

  const columns: GridColDef<PayoutSheetRow>[] = [
    { field: 'driverName', headerName: 'Driver', flex: 1, minWidth: 170 },
    {
      field: 'bank', headerName: 'Bank', width: 150,
      renderCell: ({ row }) =>
        row.hasBankAccount
          ? row.bank
          : <Chip label="No account" size="small" color="warning" variant="outlined" />,
    },
    { field: 'account', headerName: 'Account', width: 120, valueFormatter: (v) => v ?? '—' },
    { field: 'tripCount', headerName: 'Trips', width: 90, type: 'number' },
    { field: 'commission', headerName: 'Commission', width: 130, type: 'number', valueFormatter: (v) => rm(Number(v)) },
    { field: 'amount', headerName: 'Payout (RM)', width: 150, type: 'number', valueFormatter: (v) => rm(Number(v)) },
    {
      field: 'tripLog', headerName: 'Trip Log', width: 130, sortable: false, filterable: false,
      renderCell: ({ row }) => (
        <Button size="small" variant="text" onClick={() => setTripDriver(row)}>
          View Trips
        </Button>
      ),
    },
  ];

  const historyColumns: GridColDef<PayoutHistoryRow>[] = [
    {
      field: 'paidAt', headerName: 'Paid on', width: 170,
      valueFormatter: (v) => dayjs(v as string).format('DD MMM YYYY, HH:mm'),
    },
    { field: 'driverName', headerName: 'Driver', flex: 1, minWidth: 170 },
    { field: 'bank', headerName: 'Bank', width: 150, valueFormatter: (v) => v ?? '—' },
    { field: 'account', headerName: 'Account', width: 120, valueFormatter: (v) => v ?? '—' },
    { field: 'tripCount', headerName: 'Trips', width: 90, type: 'number' },
    { field: 'amount', headerName: 'Paid (RM)', width: 140, type: 'number', valueFormatter: (v) => rm(Number(v)) },
    {
      // 'pending' = instructed, not yet confirmed credited by the bank.
      field: 'status', headerName: 'Status', width: 130,
      renderCell: ({ row }) => (
        <Chip
          label={row.status} size="small" variant="outlined"
          color={row.status === 'paid' ? 'success' : row.status === 'failed' ? 'error' : 'warning'}
        />
      ),
    },
    {
      field: 'trips', headerName: 'Trip Log', width: 130, sortable: false, filterable: false,
      renderCell: ({ row }) => (
        <Button size="small" variant="text" onClick={() => setPaidPayout(row)}>
          View Trips
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={0.5}>Payout Management</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Select a date range to compute what each driver is still owed for their completed trips, then export
        the sheet to <b>{FINANCE_EMAIL}</b> for processing. Exporting marks those earnings paid, so a range
        can never be paid out twice.
      </Typography>

      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      {sheetError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSheetError('')}>{sheetError}</Alert>}
      {!sheetLoading && unpayable.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {unpayable.length} driver(s) have earnings but no bank account on file — they are listed
          below and excluded from the transfer file until they add one in the driver app.
        </Alert>
      )}

      {/* Date range filter */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="flex-end" flexWrap="wrap" useFlexGap>
          <TextField
            label="From" type="date" size="small" value={draft.start}
            onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To" type="date" size="small" value={draft.end}
            onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <Button variant="contained" onClick={applyRange}>Apply</Button>
          <Box sx={{ flexGrow: 1 }} />
          <ButtonGroup size="medium" variant="outlined">
            <Button onClick={() => applyPreset('week')}>This Week</Button>
            <Button onClick={() => applyPreset('month')}>This Month</Button>
            <Button onClick={() => applyPreset('year')}>This Year</Button>
          </ButtonGroup>
        </Stack>
      </Paper>

      {/* Summary stat cards */}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {[
          { label: 'Drivers', value: String(rows.length) },
          { label: 'Trips', value: String(totalTrips) },
          { label: 'Total', value: rm(totalAmount), highlight: true },
        ].map((c) => (
          <Paper
            key={c.label}
            variant="outlined"
            sx={{ p: 2.5, flex: '1 1 180px', minWidth: 180 }}
          >
            <Typography variant="caption" color="text.secondary" textTransform="uppercase" letterSpacing={0.5}>
              {c.label}
            </Typography>
            <Typography variant="h4" fontWeight={700} color={c.highlight ? 'success.main' : 'text.primary'}>
              {c.value}
            </Typography>
          </Paper>
        ))}
      </Stack>

      {/* Range summary */}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip label={`Range: ${period}`} color="primary" variant="outlined" />
        <Box sx={{ flexGrow: 1 }} />
        {canPay && (
          <Button
            variant="contained" disabled={rows.length === 0 || sheetLoading}
            onClick={() => setConfirm({ rows, period })}
          >
            Export &amp; Submit All ({rows.length})
          </Button>
        )}
      </Stack>

      {/* Bulk action bar for checkbox selection */}
      {canPay && selectedRows.length > 0 && (
        <Alert
          severity="info" sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" variant="outlined" onClick={() => setConfirm({ rows: selectedRows, period })}>
              Export &amp; Submit Selected
            </Button>
          }
        >
          {selectedRows.length} driver(s) selected — {rm(selectedRows.reduce((s, r) => s + r.amount, 0))}
        </Alert>
      )}

      <Box sx={{ height: 520 }}>
        <DataGrid
          rows={rows} columns={columns} getRowId={(r) => r.driverId} loading={sheetLoading}
          pageSizeOptions={[25, 50]} checkboxSelection disableRowSelectionOnClick
          rowSelectionModel={selection}
          onRowSelectionModelChange={(model) => setSelection(model)}
          slots={{ toolbar: GridToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
        />
      </Box>

      {/* Payout History — where exported (paid) trips remain visible */}
      <Divider sx={{ my: 4 }} />
      <Typography variant="h6" fontWeight={700} mb={0.5}>Payout History</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Payouts already executed in this range. Open one to see the trips it covered and the
        commission Teeko kept on each — those trips have left the sheet above.
      </Typography>

      {historyError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setHistoryError('')}>{historyError}</Alert>}

      <Box sx={{ height: 420, mb: 2 }}>
        <DataGrid
          rows={history} columns={historyColumns} loading={historyLoading}
          pageSizeOptions={[25, 50]} disableRowSelectionOnClick
          slots={{ toolbar: GridToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
        />
      </Box>

      {/* Revenue Reports section */}
      <Divider sx={{ my: 4 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
        <Typography variant="h6" fontWeight={700}>Revenue Reports</Typography>
        {can('export_reports') && (
          <Button startIcon={<Download />} size="small" variant="outlined" onClick={exportRevenueCsv} disabled={revenueLoading || !!revenueError || revenue.length === 0}>Export CSV</Button>
        )}
      </Box>

      {revenueError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRevenueError('')}>{revenueError}</Alert>}

      {revenueLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
      <>
      <Grid container spacing={2} mb={3}>
        {reportSummary.map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Typography variant="h6" fontWeight={700}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Daily Revenue (Last 30 days)</Typography>
              <BarChart
                height={280}
                series={[
                  { data: last30.map((d) => d.revenue), label: 'Revenue', color: '#1A56DB' },
                  { data: last30.map((d) => d.commissions), label: 'Commission', color: '#7E3AF2' },
                ]}
                xAxis={[{ data: last30.map((d) => d.date.slice(5)), scaleType: 'band', tickLabelStyle: { fontSize: 10 } }]}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Daily Trips (Last 7 days)</Typography>
              <LineChart
                height={280}
                series={[{ data: last7.map((d) => d.trips), label: 'Trips', color: '#057A55' }]}
                xAxis={[{ data: last7.map((d) => d.date.slice(5)), scaleType: 'band' }]}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      </>
      )}

      {/* Trip log modal */}
      <Dialog open={!!tripDriver} onClose={() => setTripDriver(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          Trip Log — {tripDriver?.driverName}
          <Typography variant="body2" color="text.secondary">
            {period} · {tripsLoading ? '…' : `${modalTrips.length} trips`}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TripTable trips={modalTrips} loading={tripsLoading} />
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Total payout: {rm(modalTrips.reduce((s, t) => s + t.net, 0))}
          </Typography>
          <Button onClick={() => setTripDriver(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Paid trip log — the breakdown behind one executed payout */}
      <Dialog open={!!paidPayout} onClose={() => setPaidPayout(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          Paid Trips — {paidPayout?.driverName}
          <Typography variant="body2" color="text.secondary">
            {paidPayout && `${rm(paidPayout.amount)} paid ${dayjs(paidPayout.paidAt).format('DD MMM YYYY, HH:mm')}`}
            {paidPayout?.bank ? ` · ${paidPayout.bank} ${paidPayout.account}` : ''}
            {' · '}{paidTripsLoading ? '…' : `${paidTrips.length} trips`}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TripTable trips={paidTrips} loading={paidTripsLoading} />
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Commission kept: {rm(paidTrips.reduce((s, t) => s + t.commission, 0))}
            {'  ·  '}
            Paid to driver: {rm(paidTrips.reduce((s, t) => s + t.net, 0))}
          </Typography>
          <Button onClick={() => setPaidPayout(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Export confirmation modal */}
      <Dialog open={!!confirm} onClose={() => !exporting && setConfirm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Export &amp; submit payment sheet?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            A payment sheet (CSV) for <b>{confirm?.period}</b> will be generated and sent to <b>{FINANCE_EMAIL}</b> for
            the external party to execute. It contains full bank account numbers.
          </Typography>
          {confirmUnpayable > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {confirmUnpayable} of these driver(s) have no bank account on file and will be left out.
            </Alert>
          )}
          <Stack direction="row" spacing={4} mb={1}>
            <Box>
              <Typography variant="caption" color="text.secondary">Drivers</Typography>
              <Typography variant="h6" fontWeight={700}>{confirm?.rows.length ?? 0}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Total</Typography>
              <Typography variant="h6" fontWeight={700}>{rm(confirmTotal)}</Typography>
            </Box>
          </Stack>
          <Divider />
          <List dense sx={{ maxHeight: 240, overflowY: 'auto' }}>
            {confirm?.rows.map((r) => (
              <ListItem key={r.driverId} disableGutters secondaryAction={<Typography variant="body2" fontWeight={600}>{rm(r.amount)}</Typography>}>
                <ListItemText
                  primary={r.driverName}
                  secondary={
                    r.hasBankAccount
                      ? `${r.bank} · ${r.account} · ${r.tripCount} trips`
                      : `No bank account · ${r.tripCount} trips`
                  }
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} disabled={exporting}>Cancel</Button>
          <Button variant="contained" onClick={confirmSubmit} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export & Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
