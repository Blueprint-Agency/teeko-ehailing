'use client';
import {
  Box, Typography, Grid, Card, CardContent, Switch, Chip,
  Stack, Slider, Alert, Button, Divider,
} from '@mui/material';
import surgeZones from '@/data/mock-surge-zones.json';
import { useRbac } from '@/hooks/useRbac';
import { useState } from 'react';

export default function SurgePage() {
  const { can } = useRbac();
  const [zones, setZones] = useState(surgeZones);
  const [done, setDone] = useState('');

  const toggleZone = (id: string) => {
    setZones((z) => z.map((zone) => zone.id === id ? { ...zone, active: !zone.active } : zone));
    setDone('Surge zone updated.');
  };

  const setMultiplier = (id: string, value: number) => {
    setZones((z) => z.map((zone) => zone.id === id ? { ...zone, multiplier: value } : zone));
  };

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Surge Control</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}

      <Grid container spacing={2}>
        {/* Map placeholder */}
        <Grid item xs={12} md={7}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Box
              sx={{
                height: 400, bgcolor: 'action.hover', borderRadius: 1, position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(128,128,128,0.12) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(128,128,128,0.12) 40px)',
              }}
            >
              {zones.filter((z) => z.active).map((z, i) => (
                <Box
                  key={z.id}
                  sx={{
                    position: 'absolute',
                    top: `${20 + i * 18}%`,
                    left: `${15 + i * 18}%`,
                    width: 90, height: 60,
                    bgcolor: z.color,
                    opacity: 0.4,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="caption" fontWeight={700} sx={{ color: '#000' }}>{z.multiplier}×</Typography>
                </Box>
              ))}
              <Typography variant="caption" sx={{ opacity: 0.4, position: 'absolute', bottom: 16 }}>
                Google Maps API key required for live map
              </Typography>
            </Box>
          </Card>
        </Grid>

        {/* Zone controls */}
        <Grid item xs={12} md={5}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Zone Rules</Typography>
              <Stack spacing={2} divider={<Divider />}>
                {zones.map((z) => (
                  <Box key={z.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: z.color }} />
                        <Typography variant="body2" fontWeight={500}>{z.name}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={z.active ? 'Active' : 'Off'} size="small" color={z.active ? 'success' : 'default'} />
                        {can('manage_surge') && (
                          <Switch size="small" checked={z.active} onChange={() => toggleZone(z.id)} />
                        )}
                      </Stack>
                    </Box>
                    <Box sx={{ px: 1, mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">Multiplier: {z.multiplier}×</Typography>
                      {can('manage_surge') && (
                        <Slider
                          size="small" min={1} max={3} step={0.1}
                          value={z.multiplier}
                          onChange={(_, v) => setMultiplier(z.id, v as number)}
                          marks={[{ value: 1, label: '1×' }, { value: 2, label: '2×' }, { value: 3, label: '3×' }]}
                        />
                      )}
                    </Box>
                  </Box>
                ))}
              </Stack>
              {can('manage_surge') && (
                <Button variant="contained" size="small" sx={{ mt: 2 }} onClick={() => setDone('Surge rules saved.')}>Save All Rules</Button>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
