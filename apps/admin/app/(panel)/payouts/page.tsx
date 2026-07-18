'use client';
import {
  Box, Typography, Button, Alert, Chip, Stack, TextField, ButtonGroup, Paper, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText,
  Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbar, GridRowSelectionModel } from '@mui/x-data-grid';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { useRbac } from '@/hooks/useRbac';
import tripsData from '@/data/mock-trips.json';
import payoutsData from '@/data/mock-payouts.json';
import driversData from '@/data/mock-drivers.json';

const FINANCE_EMAIL = 'finance@teeko.my';

interface Trip {
  id: string; driverId: string; status: string; category: string; date: string;
  pickup: string; dropoff: string; distance: number; fare: number; commission: number;
}
interface PayoutRow {
  id: string; driverName: string; bank: string; account: string;
  tripCount: number; gross: number; commission: number; amount: number;
}

const trips = tripsData as Trip[];

const accounts = new Map<string, { name: string; bank: string; account: string }>();
for (const p of payoutsData as { driverId: string; driverName: string; bank: string; account: string }[]) {
  if (!accounts.has(p.driverId)) accounts.set(p.driverId, { name: p.driverName, bank: p.bank, account: p.account });
}
const driverNames = new Map((driversData as { id: string; name: string }[]).map((d) => [d.id, d.name]));

const tripDates = trips.map((t) => t.date.slice(0, 10)).sort();
const DATA_MIN = tripDates[0] ?? dayjs().format('YYYY-MM-DD');
const DATA_MAX = tripDates[tripDates.length - 1] ?? dayjs().format('YYYY-MM-DD');

const rm = (n: number) => `RM ${Number(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const net = (t: Trip) => t.fare - t.commission;

function csvCell(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadSheet(rows: PayoutRow[], period: string) { 
  const header = ['Driver', 'Bank', 'Account', 'Trips', 'Payout (RM)', 'Period'];
  const body = rows.map((r) => [r.driverName, r.bank, r.account, r.tripCount, r.amount.toFixed(2), period]);
  const csv = [header, ...body].map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payout-sheet-${period.replace(/[^\w-]+/g, '_')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function PayoutsPage() {
  const { can } = useRbac();
  const canPay = can('trigger_payout');

  const [draft, setDraft] = useState({ start: DATA_MIN, end: DATA_MAX });
  const [applied, setApplied] = useState({ start: DATA_MIN, end: DATA_MAX });
  const [selection, setSelection] = useState<GridRowSelectionModel>([]);
  const [done, setDone] = useState('');
  const [confirm, setConfirm] = useState<{ rows: PayoutRow[]; period: string } | null>(null);
  const [tripDriver, setTripDriver] = useState<string | null>(null);

  const period = `${applied.start} – ${applied.end}`;

  const rangeTrips = useMemo(
    () => trips.filter((t) => t.status === 'completed' && t.date.slice(0, 10) >= applied.start && t.date.slice(0, 10) <= applied.end),
    [applied]
  );

  const rows = useMemo(() => {
    const byDriver = new Map<string, Trip[]>();
    for (const t of rangeTrips) {
      if (!byDriver.has(t.driverId)) byDriver.set(t.driverId, []);
      byDriver.get(t.driverId)!.push(t);
    }
    return [...byDriver.entries()]
      .map(([driverId, ts]): PayoutRow => {
        const acct = accounts.get(driverId);
        return {
          id: driverId,
          driverName: acct?.name ?? driverNames.get(driverId) ?? driverId,
          bank: acct?.bank ?? '—',
          account: acct?.account ?? '—',
          tripCount: ts.length,
          gross: ts.reduce((s, t) => s + t.fare, 0),
          commission: ts.reduce((s, t) => s + t.commission, 0),
          amount: ts.reduce((s, t) => s + net(t), 0),
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [rangeTrips]);

  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

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

  const selectedRows = useMemo(() => rows.filter((r) => selection.includes(r.id)), [rows, selection]);

  const confirmSubmit = () => {
    if (!confirm) return;
    downloadSheet(confirm.rows, confirm.period);
    setSelection([]);
    setConfirm(null);
    setDone(`Sheet for ${confirm.rows.length} driver(s) — ${rm(confirm.rows.reduce((s, r) => s + r.amount, 0))} — exported and sent to ${FINANCE_EMAIL}.`);
  };
  const confirmTotal = confirm ? confirm.rows.reduce((s, r) => s + r.amount, 0) : 0;

  const modalTrips = useMemo(
    () => (tripDriver ? rangeTrips.filter((t) => t.driverId === tripDriver).sort((a, b) => a.date.localeCompare(b.date)) : []),
    [tripDriver, rangeTrips]
  );
  const modalDriverName = tripDriver ? rows.find((r) => r.id === tripDriver)?.driverName : '';

  const columns: GridColDef[] = [
    { field: 'driverName', headerName: 'Driver', flex: 1, minWidth: 170 },
    { field: 'bank', headerName: 'Bank', width: 120 },
    { field: 'account', headerName: 'Account', width: 110 },
    { field: 'tripCount', headerName: 'Trips', width: 90, type: 'number' },
    { field: 'commission', headerName: 'Commission', width: 130, type: 'number', valueFormatter: (v) => rm(Number(v)) },
    { field: 'amount', headerName: 'Payout (RM)', width: 150, type: 'number', valueFormatter: (v) => rm(Number(v)) },
    {
      field: 'tripLog', headerName: 'Trip Log', width: 130, sortable: false, filterable: false,
      renderCell: ({ row }) => (
        <Button size="small" variant="text" onClick={() => setTripDriver(row.id)}>
          View Trips
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={0.5}>Payout Management</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Select a date range to compute each driver&apos;s payout from their completed trips, then export the
        sheet to <b>{FINANCE_EMAIL}</b> for processing.
      </Typography>

      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}

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
          <ButtonGroup size="medium" variant="outlined">
            <Button onClick={() => applyPreset('week')}>This Week</Button>
            <Button onClick={() => applyPreset('month')}>This Month</Button>
            <Button onClick={() => applyPreset('year')}>This Year</Button>
          </ButtonGroup>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Trip data available {DATA_MIN} to {DATA_MAX}
          </Typography>
        </Stack>
      </Paper>

      {/* Range summary */}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip label={`Range: ${period}`} color="primary" variant="outlined" />
        <Chip label={`${rows.length} drivers`} variant="outlined" />
        <Chip label={`${rangeTrips.length} trips`} variant="outlined" />
        <Chip label={`Total ${rm(totalAmount)}`} color="success" variant="outlined" />
        <Box sx={{ flexGrow: 1 }} />
        {canPay && (
          <Button
            variant="contained" disabled={rows.length === 0}
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
          rows={rows} columns={columns}
          pageSizeOptions={[25, 50]} checkboxSelection disableRowSelectionOnClick
          rowSelectionModel={selection}
          onRowSelectionModelChange={(model) => setSelection(model)}
          slots={{ toolbar: GridToolbar }} slotProps={{ toolbar: { showQuickFilter: true } }}
        />
      </Box>

      {/* Trip log modal */}
      <Dialog open={!!tripDriver} onClose={() => setTripDriver(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          Trip Log — {modalDriverName}
          <Typography variant="body2" color="text.secondary">{period} · {modalTrips.length} trips</Typography>
        </DialogTitle>
        <DialogContent>
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
              {modalTrips.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{dayjs(t.date).format('DD MMM YYYY, HH:mm')}</TableCell>
                  <TableCell>{t.pickup} → {t.dropoff}</TableCell>
                  <TableCell><Chip label={t.category} size="small" variant="outlined" /></TableCell>
                  <TableCell align="right">{rm(t.fare)}</TableCell>
                  <TableCell align="right">{rm(t.commission)}</TableCell>
                  <TableCell align="right"><b>{rm(net(t))}</b></TableCell>
                </TableRow>
              ))}
              {modalTrips.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center">No trips in this range.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Total payout: {rm(modalTrips.reduce((s, t) => s + net(t), 0))}
          </Typography>
          <Button onClick={() => setTripDriver(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Export confirmation modal */}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Export &amp; submit payment sheet?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            A payment sheet (CSV) for <b>{confirm?.period}</b> will be generated and sent to <b>{FINANCE_EMAIL}</b> for
            the external party to execute.
          </Typography>
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
              <ListItem key={r.id} disableGutters secondaryAction={<Typography variant="body2" fontWeight={600}>{rm(r.amount)}</Typography>}>
                <ListItemText primary={r.driverName} secondary={`${r.bank} · ${r.account} · ${r.tripCount} trips`} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmSubmit}>Export &amp; Submit</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
