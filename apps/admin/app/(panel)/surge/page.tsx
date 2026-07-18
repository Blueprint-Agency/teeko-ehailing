'use client';
import {
  Box, Typography, Grid, Card, CardContent, Switch, Chip,
  Stack, Slider, Alert, Button, Divider, CircularProgress,
} from '@mui/material';
import { useRbac } from '@/hooks/useRbac';
import { useState, useEffect, useCallback } from 'react';
import { adminApi, SurgeZone } from '@/lib/api';

const DEFAULT_ZONE_COLOR = '#FF8C00';

export default function SurgePage() {
  const { can } = useRbac();
  const canEdit = can('manage_surge');

  const [zones, setZones] = useState<SurgeZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [saving, setSaving] = useState<string | null>(null); // zone id currently persisting

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setZones(await adminApi.getSurgeZones());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load surge zones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Persist a change to one zone ─────────────────────────────────────────────
  async function persist(id: string, changes: { multiplier?: number; active?: boolean }, message: string) {
    setSaving(id);
    setError('');
    try {
      const { zone } = await adminApi.updateSurgeZone(id, changes);
      setZones((z) => z.map((it) => (it.id === id ? zone : it)));
      setDone(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update zone');
      await load(); // resync on failure
    } finally {
      setSaving(null);
    }
  }

  const toggleZone = (zone: SurgeZone) =>
    persist(zone.id, { active: !zone.active }, `${zone.name} surge turned ${zone.active ? 'off' : 'on'}.`);

  // Slider drag updates local state only; commit persists on release.
  const setMultiplierLocal = (id: string, value: number) =>
    setZones((z) => z.map((zone) => (zone.id === id ? { ...zone, multiplier: value } : zone)));

  const commitMultiplier = (zone: SurgeZone, value: number) =>
    persist(zone.id, { multiplier: value }, `${zone.name} multiplier set to ${value}×.`);

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Surge Control</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      ) : (
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
                    bgcolor: z.color ?? DEFAULT_ZONE_COLOR,
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
              {zones.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No surge zones configured.</Typography>
              ) : (
              <Stack spacing={2} divider={<Divider />}>
                {zones.map((z) => {
                  const isSaving = saving === z.id;
                  return (
                  <Box key={z.id} sx={{ opacity: isSaving ? 0.6 : 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 12, height: 12, borderRadius: 1, bgcolor: z.color ?? DEFAULT_ZONE_COLOR }} />
                        <Typography variant="body2" fontWeight={500}>{z.name}</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={z.active ? 'Active' : 'Off'} size="small" color={z.active ? 'success' : 'default'} />
                        {canEdit && (
                          <Switch size="small" checked={z.active} onChange={() => toggleZone(z)} disabled={isSaving} />
                        )}
                      </Stack>
                    </Box>
                    <Box sx={{ px: 1, mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">Multiplier: {z.multiplier}×</Typography>
                      {canEdit && (
                        <Slider
                          size="small" min={1} max={3} step={0.1}
                          value={z.multiplier}
                          disabled={isSaving}
                          onChange={(_, v) => setMultiplierLocal(z.id, v as number)}
                          onChangeCommitted={(_, v) => commitMultiplier(z, v as number)}
                          marks={[{ value: 1, label: '1×' }, { value: 2, label: '2×' }, { value: 3, label: '3×' }]}
                        />
                      )}
                    </Box>
                  </Box>
                  );
                })}
              </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      )}
    </Box>
  );
}
