'use client';
import {
  Box, Typography, Grid, Card, CardContent, TextField, Button,
  Alert, CircularProgress, Chip, Tooltip, IconButton, Table, TableBody,
  TableCell, TableHead, TableRow, Divider, Stack,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useRbac } from '@/hooks/useRbac';
import { useState, useEffect, useCallback } from 'react';
import {
  adminApi,
  CommissionDriverRow,
  CommissionSettings,
} from '@/lib/api';
import RestoreIcon from '@mui/icons-material/Restore';

const CATEGORY_LABELS: Record<string, string> = {
  go: 'Go',
  comfort: 'Comfort',
  xl: 'XL',
  premium: 'Premium',
  bike: 'Bike',
};

function SourceChip({ source }: { source: 'driver' | 'category' | 'platform' }) {
  const map = {
    driver: { label: 'Driver', color: 'error' as const },
    category: { label: 'Category', color: 'warning' as const },
    platform: { label: 'Platform', color: 'default' as const },
  };
  const { label, color } = map[source];
  return (
    <Chip
      label={label}
      size="small"
      color={color}
      variant={source === 'platform' ? 'outlined' : 'filled'}
      sx={{ height: 20, fontSize: 11 }}
    />
  );
}

export default function CommissionsPage() {
  const { can } = useRbac();
  const canEdit = can('adjust_commission');

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [settings, setSettings] = useState<CommissionSettings | null>(null);
  const [drivers, setDrivers] = useState<CommissionDriverRow[]>([]);

  // Pending local edits (as percent strings), keyed by field
  const [platformEdit, setPlatformEdit] = useState('');
  const [categoryEdits, setCategoryEdits] = useState<Record<string, string>>({});
  const [driverEdits, setDriverEdits] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');

  const [saving, setSaving] = useState<string | null>(null); // key of what's being saved

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, d] = await Promise.all([
        adminApi.getCommissionSettings(),
        adminApi.getCommissionDrivers(),
      ]);
      setSettings(s);
      setDrivers(d);
      setPlatformEdit(String(s.platform.rate));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load commission data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  async function withSaving(key: string, fn: () => Promise<void>) {
    setSaving(key);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed');
    } finally {
      setSaving(null);
    }
  }

  // ── Platform handler ───────────────────────────────────────────────────────
  async function handleSavePlatform() {
    await withSaving('platform', async () => {
      await adminApi.updatePlatformRate(parseFloat(platformEdit));
      setSuccess(`Platform rate saved as ${platformEdit}%.`);
    });
  }

  // ── Category handlers ──────────────────────────────────────────────────────
  async function handleSaveCategory(cat: string) {
    const rate = parseFloat(categoryEdits[cat] ?? '');
    await withSaving(`cat:${cat}`, async () => {
      await adminApi.updateCategoryRate(cat, rate);
      setSuccess(`${CATEGORY_LABELS[cat]} category rate set to ${rate}%.`);
      setCategoryEdits((prev) => { const n = { ...prev }; delete n[cat]; return n; });
    });
  }

  async function handleClearCategory(cat: string) {
    await withSaving(`cat:${cat}`, async () => {
      await adminApi.deleteCategoryRate(cat);
      setSuccess(`${CATEGORY_LABELS[cat]} override cleared — will use the platform default.`);
    });
  }

  // ── Driver override handlers ───────────────────────────────────────────────
  async function handleSaveDriver(driverId: string) {
    const rate = parseFloat(driverEdits[driverId] ?? '');
    await withSaving(`drv:${driverId}`, async () => {
      await adminApi.updateDriverCommission(driverId, rate);
      setSuccess('Driver override saved.');
      setDriverEdits((prev) => { const n = { ...prev }; delete n[driverId]; return n; });
    });
  }

  async function handleClearDriver(driverId: string) {
    await withSaving(`drv:${driverId}`, async () => {
      await adminApi.deleteDriverCommission(driverId);
      setSuccess('Driver override cleared — will inherit category or platform rate.');
    });
  }

  // ── Driver grid columns ────────────────────────────────────────────────────
  const driverColumns: GridColDef<CommissionDriverRow>[] = [
    { field: 'name', headerName: 'Driver', flex: 1, minWidth: 160 },
    { field: 'category', headerName: 'Category', width: 100,
      valueFormatter: (v: string) => CATEGORY_LABELS[v] ?? v },
    { field: 'trips', headerName: 'Trips', width: 75, type: 'number' },
    {
      field: 'rate',
      headerName: 'Effective Rate',
      width: 150,
      renderCell: (params: GridRenderCellParams<CommissionDriverRow>) => {
        const driverId = params.row.id;
        const isEditing = driverId in driverEdits;
        const isSaving = saving === `drv:${driverId}`;
        const displayVal = isEditing ? driverEdits[driverId] : String(params.row.rate);

        if (!canEdit) return <span>{params.row.rate}%</span>;

        return (
          <Box display="flex" alignItems="center" gap={0.5}>
            <TextField
              value={displayVal}
              size="small"
              type="number"
              inputProps={{ min: 5, max: 40, step: 0.5, style: { width: 52, padding: '2px 6px' } }}
              sx={{ '& .MuiInputBase-root': { height: 26 } }}
              onChange={(e) => setDriverEdits((p) => ({ ...p, [driverId]: e.target.value }))}
              disabled={isSaving}
            />
            <Typography variant="caption" sx={{ mr: 0.5 }}>%</Typography>
            {isEditing && (
              <Button
                size="small" variant="contained"
                sx={{ minWidth: 0, px: 1, py: 0, height: 24, fontSize: 11 }}
                onClick={() => handleSaveDriver(driverId)}
                disabled={isSaving}
              >
                {isSaving ? <CircularProgress size={11} /> : 'Save'}
              </Button>
            )}
          </Box>
        );
      },
    },
    {
      field: 'source',
      headerName: 'Source',
      width: 100,
      renderCell: (params: GridRenderCellParams<CommissionDriverRow>) =>
        <SourceChip source={params.row.source} />,
    },
    ...(canEdit ? [{
      field: '_actions',
      headerName: '',
      width: 50,
      sortable: false,
      renderCell: (params: GridRenderCellParams<CommissionDriverRow>) => {
        if (params.row.source !== 'driver') return null;
        const isSaving = saving === `drv:${params.row.id}`;
        return (
          <Tooltip title="Clear driver override">
            <IconButton size="small" sx={{ p: 0.25 }}
              onClick={() => handleClearDriver(params.row.id)}
              disabled={isSaving}
            >
              <RestoreIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        );
      },
    } as GridColDef<CommissionDriverRow>] : []),
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={0.5}>Commission Settings</Typography>
      <Typography variant="body2" color="text.secondary" mb={2.5}>
        Rates resolve in priority order: <strong>Driver</strong> › <strong>Category</strong> › <strong>Platform</strong>
      </Typography>

      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error   && <Alert severity="error"   sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      ) : (
        <Stack spacing={2}>
          {/* ── Row 1: Platform + Category ─────────────────────────────────── */}
          <Grid container spacing={2}>
            {/* Platform */}
            <Grid item xs={12} md={4}>
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
                    Platform Default
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                    Fallback when no category or driver override applies.
                  </Typography>

                  <Box display="flex" alignItems="center" gap={1}>
                    <TextField
                      label="Rate (%)" value={platformEdit} size="small"
                      type="number" inputProps={{ min: 5, max: 40, step: 0.5 }}
                      sx={{ width: 110 }}
                      onChange={(e) => setPlatformEdit(e.target.value)}
                      disabled={!canEdit || saving === 'platform'}
                    />
                    {canEdit && (
                      <Button
                        variant="contained" size="small"
                        onClick={handleSavePlatform}
                        disabled={saving === 'platform'}
                        startIcon={saving === 'platform' ? <CircularProgress size={13} /> : undefined}
                      >
                        Save
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Category overrides */}
            <Grid item xs={12} md={8}>
              <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
                    Category Overrides
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                    Override the platform rate for a whole vehicle category.
                  </Typography>

                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Rate (%)</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                        {canEdit && <TableCell />}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(settings?.categories ?? []).map((row) => {
                        const isEditing = row.category in categoryEdits;
                        const isSaving = saving === `cat:${row.category}`;
                        const displayVal = isEditing
                          ? categoryEdits[row.category]
                          : String(row.rate);

                        return (
                          <TableRow key={row.category} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>
                                {CATEGORY_LABELS[row.category] ?? row.category}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {canEdit ? (
                                <Box display="flex" alignItems="center" gap={0.5}>
                                  <TextField
                                    value={displayVal}
                                    size="small" type="number"
                                    inputProps={{ min: 5, max: 40, step: 0.5, style: { width: 52, padding: '2px 6px' } }}
                                    sx={{ '& .MuiInputBase-root': { height: 26 } }}
                                    onChange={(e) =>
                                      setCategoryEdits((p) => ({ ...p, [row.category]: e.target.value }))
                                    }
                                    disabled={isSaving}
                                  />
                                  <Typography variant="caption">%</Typography>
                                  {isEditing && (
                                    <Button
                                      size="small" variant="contained"
                                      sx={{ minWidth: 0, px: 1, py: 0, height: 24, fontSize: 11 }}
                                      onClick={() => handleSaveCategory(row.category)}
                                      disabled={isSaving}
                                    >
                                      {isSaving ? <CircularProgress size={11} /> : 'Save'}
                                    </Button>
                                  )}
                                </Box>
                              ) : (
                                <Typography variant="body2">{row.rate}%</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={row.isOverride ? 'Override' : 'Platform default'}
                                size="small"
                                color={row.isOverride ? 'warning' : 'default'}
                                variant={row.isOverride ? 'filled' : 'outlined'}
                                sx={{ height: 20, fontSize: 11 }}
                              />
                            </TableCell>
                            {canEdit && (
                              <TableCell align="right">
                                {row.isOverride && (
                                  <Tooltip title="Clear — revert to platform default">
                                    <IconButton
                                      size="small" sx={{ p: 0.25 }}
                                      onClick={() => handleClearCategory(row.category)}
                                      disabled={isSaving}
                                    >
                                      <RestoreIcon fontSize="inherit" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* ── Row 2: All drivers ────────────────────────────────────────── */}
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5} flexWrap="wrap" gap={1}>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700}>
                    Drivers — Effective Rates
                    {search && (
                      <Typography component="span" variant="caption" color="text.secondary" ml={1}>
                        {drivers.filter(d =>
                          d.name.toLowerCase().includes(search.toLowerCase()) ||
                          (CATEGORY_LABELS[d.category] ?? d.category).toLowerCase().includes(search.toLowerCase())
                        ).length} of {drivers.length} shown
                      </Typography>
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Shows every driver's resolved rate and which tier it comes from.
                    Edit inline to add or update a driver-level override.
                  </Typography>
                </Box>
                <TextField
                  placeholder="Search name or category…"
                  size="small"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  sx={{ width: 240 }}
                  inputProps={{ 'aria-label': 'search drivers' }}
                />
              </Box>
              <Box sx={{ height: 420 }}>
                <DataGrid
                  rows={drivers.filter(d =>
                    !search ||
                    d.name.toLowerCase().includes(search.toLowerCase()) ||
                    (CATEGORY_LABELS[d.category] ?? d.category).toLowerCase().includes(search.toLowerCase())
                  )}
                  getRowId={(r) => r.id}
                  columns={driverColumns}
                  pageSizeOptions={[25, 50]}
                  disableRowSelectionOnClick
                  density="compact"
                  initialState={{ sorting: { sortModel: [{ field: 'name', sort: 'asc' }] } }}
                />
              </Box>
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  );
}
