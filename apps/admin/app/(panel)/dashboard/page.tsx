'use client';
import {
  Box, Grid, Card, CardContent, Typography, Chip, Alert,
  Stack, Divider, List, ListItem, ListItemText, LinearProgress,
} from '@mui/material';
import {
  DirectionsCar, People, LocalTaxi, AttachMoney,
  TrendingUp, Warning,
} from '@mui/icons-material';
import { useEffect, useState } from 'react';
import { useDriverStore } from '@/stores/driver';
import { useTripStore } from '@/stores/trip';
import { useRiderStore } from '@/stores/rider';
import { useDisputeStore } from '@/stores/dispute';

interface Metric {
  label: string;
  value: string | number;
  delta: string;
  positive: boolean;
  icon: React.ReactNode;
  color: string;
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
  const trips = useTripStore((s) => s.trips);
  const riders = useRiderStore((s) => s.riders);
  const disputes = useDisputeStore((s) => s.disputes);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const activeDrivers = drivers.filter((d) => d.status === 'active').length;
  const onlineDrivers = Math.floor(activeDrivers * (0.6 + (tick % 3) * 0.05));
  const activeTrips = trips.filter((t) => t.status === 'in_progress').length + (tick % 2);
  const todayTrips = trips.filter((t) => t.date.startsWith('2026-05-14')).length;
  const todayRevenue = trips
    .filter((t) => t.date.startsWith('2026-05-14') && t.status === 'completed')
    .reduce((s, t) => s + t.fare, 0);
  const openDisputes = disputes.filter((d) => d.status === 'open' || d.status === 'escalated').length;

  const metrics: Metric[] = [
    { label: 'Active Trips', value: activeTrips, delta: `+${tick % 3} last 10 min`, positive: true, icon: <LocalTaxi sx={{ fontSize: 32 }} />, color: '#1A56DB' },
    { label: 'Drivers Online', value: onlineDrivers, delta: `of ${activeDrivers} active`, positive: true, icon: <DirectionsCar sx={{ fontSize: 32 }} />, color: '#7E3AF2' },
    { label: "Today's Trips", value: todayTrips, delta: '+12% vs yesterday', positive: true, icon: <TrendingUp sx={{ fontSize: 32 }} />, color: '#057A55' },
    { label: "Today's Revenue", value: `RM ${todayRevenue.toFixed(2)}`, delta: '+8.4% vs yesterday', positive: true, icon: <AttachMoney sx={{ fontSize: 32 }} />, color: '#FF5A1F' },
    { label: 'Open Disputes', value: openDisputes, delta: '2 escalated', positive: false, icon: <Warning sx={{ fontSize: 32 }} />, color: '#E02424' },
    { label: 'Total Riders', value: riders.length, delta: '+3 this week', positive: true, icon: <People sx={{ fontSize: 32 }} />, color: '#057A55' },
  ];

  const recentAlerts = [
    { id: 1, msg: 'Dispute #dis4 escalated — double charge confirmed', sev: 'error' as const },
    { id: 2, msg: 'Payout failed for Mohd Hafiz (RHB) — invalid account', sev: 'warning' as const },
    { id: 3, msg: 'Driver EVP expired: Siti Aminah Binti Kadir', sev: 'warning' as const },
    { id: 4, msg: 'New pending driver application: Mohd Azlan Bin Che Hassan', sev: 'info' as const },
  ];

  const pendingDrivers = drivers.filter((d) => d.status === 'pending');
  const cityBreakdown = [
    { city: 'Kuala Lumpur', trips: 142, pct: 72 },
    { city: 'Petaling Jaya', trips: 38, pct: 52 },
    { city: 'Shah Alam', trips: 22, pct: 38 },
    { city: 'Subang Jaya', trips: 18, pct: 30 },
    { city: 'Others', trips: 15, pct: 22 },
  ];

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Platform Overview</Typography>

      <Grid container spacing={2} mb={3}>
        {metrics.map((m) => (
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
                {recentAlerts.map((a) => (
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
            </CardContent>
          </Card>
        </Grid>

        {/* City breakdown */}
        <Grid item xs={12} md={3}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Today — Trips by City</Typography>
              <Stack spacing={1.5}>
                {cityBreakdown.map((c) => (
                  <Box key={c.city}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" fontWeight={500}>{c.city}</Typography>
                      <Typography variant="caption" color="text.secondary">{c.trips}</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={c.pct} sx={{ height: 6, borderRadius: 3 }} />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
