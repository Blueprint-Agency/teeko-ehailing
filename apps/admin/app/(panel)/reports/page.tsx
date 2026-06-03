'use client';
import {
  Box, Typography, Grid, Card, CardContent, Stack, Chip, Button,
} from '@mui/material';
import { BarChart, LineChart } from '@mui/x-charts';
import { Download } from '@mui/icons-material';
import revenueData from '@/data/mock-revenue.json';
import { useRbac } from '@/hooks/useRbac';

export default function ReportsPage() {
  const { can } = useRbac();
  const last30 = revenueData.slice(-30);
  const last7 = revenueData.slice(-7);

  const totalRevenue = last30.reduce((s, d) => s + d.revenue, 0);
  const totalCommissions = last30.reduce((s, d) => s + d.commissions, 0);
  const totalPayouts = last30.reduce((s, d) => s + d.payouts, 0);
  const totalTrips = last30.reduce((s, d) => s + d.trips, 0);

  const summary = [
    { label: '30-day Revenue',    value: `RM ${totalRevenue.toLocaleString()}` },
    { label: '30-day Commission', value: `RM ${totalCommissions.toLocaleString()}` },
    { label: '30-day Payouts',    value: `RM ${totalPayouts.toLocaleString()}` },
    { label: '30-day Trips',      value: totalTrips.toLocaleString() },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
        <Typography variant="h6" fontWeight={700}>Revenue Reports</Typography>
        {can('export_reports') && (
          <Button startIcon={<Download />} size="small" variant="outlined">Export CSV</Button>
        )}
      </Box>

      <Grid container spacing={2} mb={3}>
        {summary.map((s) => (
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
    </Box>
  );
}
