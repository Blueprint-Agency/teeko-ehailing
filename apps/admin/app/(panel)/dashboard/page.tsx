'use client';
import {
  Box, Grid, Card, CardContent, Typography, Chip, Alert,
  Stack, List, ListItem, ListItemText, LinearProgress, CircularProgress,
} from '@mui/material';
import {
  DirectionsCar, People, LocalTaxi, AttachMoney,
  TrendingUp, Warning,
} from '@mui/icons-material';
import { useEffect, useState, useCallback } from 'react';
import { useDriverStore } from '@/stores/driver';
import { adminApi, type MetricsOverview } from '@/lib/api';

const POLL_MS = 10000;

interface Metric {
  label: string;
  value: string | number;
  delta: string;
  positive: boolean;
  icon: React.ReactNode;
  color: string;
}

// A signed percentage like "+12.5%", or "No data" when there's no baseline.
function fmtDelta(pct: number | null): string {
  if (pct === null) return 'No data';
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={500} textTransform="uppercase" letterSpacing={0.5}>
              {metric.label}
            </Typography>
            <Typography variant="h4" fontWeight={700} mt={0.5}>{metric.value}</Typography>
          </Box>
          <Box sx={{ color: metric.color, opacity: 0.8 }}>{metric.icon}</Box>
        </Box>
        <Chip
          label={metric.delta}
          size="small"
          sx={{
            mt: 1.5,
            fontSize: 11,
            bgcolor: metric.positive ? 'success.light' : 'error.light',
            color: metric.positive ? 'success.dark' : 'error.dark',
          }}
        />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const drivers = useDriverStore((s) => s.drivers);
  const loadDrivers = useDriverStore((s) => s.loadDrivers);

  const [metrics, setMetrics] = useState<MetricsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setMetrics(await adminApi.getMetricsOverview());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDrivers();
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [loadDrivers, load]);

  const pendingDrivers = drivers.filter((d) => d.status === 'pending');

  const cards: Metric[] = metrics
    ? [
        { label: 'Active Trips', value: metrics.activeTrips, delta: 'live now', positive: true, icon: <LocalTaxi sx={{ fontSize: 32 }} />, color: '#1A56DB' },
        { label: 'Drivers Online', value: metrics.driversOnline, delta: `of ${metrics.activeDrivers} active`, positive: true, icon: <DirectionsCar sx={{ fontSize: 32 }} />, color: '#7E3AF2' },
        { label: "Today's Trips", value: metrics.todayTrips, delta: `${fmtDelta(metrics.todayTripsDeltaPct)} vs yesterday`, positive: (metrics.todayTripsDeltaPct ?? 0) >= 0, icon: <TrendingUp sx={{ fontSize: 32 }} />, color: '#057A55' },
        { label: "Today's Revenue", value: `RM ${metrics.todayRevenue.toFixed(2)}`, delta: `${fmtDelta(metrics.todayRevenueDeltaPct)} vs yesterday`, positive: (metrics.todayRevenueDeltaPct ?? 0) >= 0, icon: <AttachMoney sx={{ fontSize: 32 }} />, color: '#FF5A1F' },
        { label: 'Open Disputes', value: metrics.openDisputes, delta: metrics.openDisputes > 0 ? 'needs review' : 'all clear', positive: metrics.openDisputes === 0, icon: <Warning sx={{ fontSize: 32 }} />, color: '#E02424' },
        { label: 'Total Riders', value: metrics.totalRiders, delta: `+${metrics.newRidersThisWeek} this week`, positive: true, icon: <People sx={{ fontSize: 32 }} />, color: '#057A55' },
      ]
    : [];

  // Alerts derived from real signals rather than a canned list.
  const alerts: { id: string; msg: string; sev: 'error' | 'warning' | 'info' }[] = [];
  if (metrics && metrics.openDisputes > 0) {
    alerts.push({ id: 'disputes', msg: `${metrics.openDisputes} open dispute${metrics.openDisputes > 1 ? 's' : ''} awaiting review`, sev: 'error' });
  }
  if (pendingDrivers.length > 0) {
    alerts.push({ id: 'pending', msg: `${pendingDrivers.length} pending driver application${pendingDrivers.length > 1 ? 's' : ''} to review`, sev: 'warning' });
  }
  if (alerts.length === 0) {
    alerts.push({ id: 'clear', msg: 'All clear — nothing needs attention right now.', sev: 'info' });
  }

  const maxCategoryTrips = Math.max(1, ...(metrics?.todayByCategory.map((c) => c.trips) ?? [0]));

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Platform Overview</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading && !metrics ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      ) : (
      <>
      <Grid container spacing={2} mb={3}>
        {cards.map((m) => (
          <Grid item xs={12} sm={6} md={4} key={m.label}>
            <MetricCard metric={m} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        {/* Alerts */}
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Alerts & Attention Required</Typography>
              <Stack spacing={1}>
                {alerts.map((a) => (
                  <Alert key={a.id} severity={a.sev} sx={{ py: 0.5 }}>
                    <Typography variant="caption">{a.msg}</Typography>
                  </Alert>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Pending drivers */}
        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>
                Pending Applications
                <Chip label={pendingDrivers.length} size="small" color="warning" sx={{ ml: 1 }} />
              </Typography>
              {pendingDrivers.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No pending applications.</Typography>
              ) : (
              <List dense disablePadding>
                {pendingDrivers.map((d) => (
                  <ListItem key={d.id} disablePadding sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={d.name}
                      secondary={`${d.category} · ${d.city}`}
                      primaryTypographyProps={{ fontSize: 12, fontWeight: 500 }}
                      secondaryTypographyProps={{ fontSize: 11 }}
                    />
                  </ListItem>
                ))}
              </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Trips by category */}
        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Today — Trips by Category</Typography>
              {!metrics || metrics.todayByCategory.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No trips yet today.</Typography>
              ) : (
              <Stack spacing={1.5}>
                {metrics.todayByCategory.map((c) => (
                  <Box key={c.category}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" fontWeight={500} textTransform="capitalize">{c.category}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.trips}</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={(c.trips / maxCategoryTrips) * 100} sx={{ height: 6, borderRadius: 3 }} />
                  </Box>
                ))}
              </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      </>
      )}
    </Box>
  );
}
