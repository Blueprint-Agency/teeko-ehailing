'use client';
import {
  Box, Typography, Grid, Card, CardContent, Switch, Chip,
  Stack, Slider, Alert, Button, Divider, CircularProgress,
} from '@mui/material';
import { APIProvider, Map, Marker, Polygon } from '@vis.gl/react-google-maps';
import { useRbac } from '@/hooks/useRbac';
import { Fragment, useState, useEffect, useCallback } from 'react';
import { adminApi, SurgeConfig, SurgeZone } from '@/lib/api';

const DEFAULT_ZONE_COLOR = '#FF8C00';
const KL_CENTER = { lat: 3.1478, lng: 101.6953 };
const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Rough centroid of a zone's boundary — good enough to anchor its multiplier
// label. Averaging the ring vertices, not an area-weighted centroid.
function centroid(pts: { lat: number; lng: number }[]) {
  if (pts.length === 0) return null;
  const sum = pts.reduce((a, p) => ({ lat: a.lat + p.lat, lng: a.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / pts.length, lng: sum.lng / pts.length };
}

// A small rounded pill (rendered as a marker icon) showing the zone multiplier.
const labelIcon = (text: string, color: string) =>
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="24" viewBox="0 0 46 24">` +
      `<rect x="1" y="1" width="44" height="22" rx="11" fill="${color}" stroke="#fff" stroke-width="1.5"/>` +
      `<text x="23" y="16" font-family="sans-serif" font-size="11" font-weight="700" text-anchor="middle" fill="#000">${text}</text></svg>`,
  );

export default function SurgePage() {
  const { can } = useRbac();
  const canEdit = can('manage_surge');

  const [config, setConfig] = useState<SurgeConfig | null>(null);
  const [zones, setZones] = useState<SurgeZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [saving, setSaving] = useState<string | null>(null); // zone id currently persisting
  const [savingConfig, setSavingConfig] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cfg, zs] = await Promise.all([adminApi.getSurgeConfig(), adminApi.getSurgeZones()]);
      setConfig(cfg);
      setZones(zs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load surge control');
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

  // ── General KL surge (base rate; zones override it) ──────────────────────────
  // Slider drag updates local state only; commit persists on release.
  const setConfigLocal = (value: number) =>
    setConfig((c) => (c ? { ...c, multiplier: value } : c));

  async function commitConfig(value: number) {
    setSavingConfig(true);
    setError('');
    try {
      const { config: updated } = await adminApi.updateSurgeConfig(value);
      setConfig(updated);
      setDone(`General KL surge set to ${value}×.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update general surge');
      await load(); // resync on failure
    } finally {
      setSavingConfig(false);
    }
  }

  return (
    <Box>
      <Typography variant="h6" fontWeight={700} mb={2.5}>Surge Control</Typography>
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {!MAPS_API_KEY && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to render the surge map.
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
      ) : (
      <>
      {/* General KL surge — the base rate applied wherever no zone overrides it */}
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 2, opacity: savingConfig ? 0.6 : 1 }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="subtitle2" fontWeight={600}>General Surge — Kuala Lumpur</Typography>
              <Typography variant="caption" color="text.secondary">
                Base multiplier across KL. Zones below override it for their areas.
              </Typography>
            </Box>
            <Chip
              label={config && config.multiplier > 1 ? `${config.multiplier}× city-wide` : 'No general surge'}
              size="small"
              color={config && config.multiplier > 1 ? 'warning' : 'default'}
            />
          </Box>
          <Box sx={{ px: 1, mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Multiplier: {config?.multiplier ?? 1}×
            </Typography>
            {canEdit && config && (
              <Slider
                size="small" min={1} max={3} step={0.1}
                value={config.multiplier}
                disabled={savingConfig}
                onChange={(_, v) => setConfigLocal(v as number)}
                onChangeCommitted={(_, v) => commitConfig(v as number)}
                marks={[{ value: 1, label: '1×' }, { value: 2, label: '2×' }, { value: 3, label: '3×' }]}
              />
            )}
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {/* Surge zone map */}
        <Grid item xs={12} md={7}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ height: 400, borderRadius: 1, overflow: 'hidden', position: 'relative' }}>
              {MAPS_API_KEY ? (
                <APIProvider apiKey={MAPS_API_KEY}>
                  <Map
                    defaultCenter={KL_CENTER}
                    defaultZoom={12}
                    gestureHandling="greedy"
                    disableDefaultUI
                    style={{ width: '100%', height: '100%' }}
                  >
                    {zones.map((z) => {
                      if (z.polygon.length < 3) return null;
                      const color = z.color ?? DEFAULT_ZONE_COLOR;
                      const center = centroid(z.polygon);
                      return (
                        <Fragment key={z.id}>
                          <Polygon
                            paths={z.polygon}
                            strokeColor={color}
                            strokeOpacity={z.active ? 0.9 : 0.4}
                            strokeWeight={2}
                            fillColor={color}
                            fillOpacity={z.active ? 0.35 : 0.1}
                          />
                          {z.active && center && (
                            <Marker
                              position={center}
                              icon={labelIcon(`${z.multiplier}×`, color)}
                              title={`${z.name} · ${z.multiplier}×`}
                            />
                          )}
                        </Fragment>
                      );
                    })}
                  </Map>
                </APIProvider>
              ) : (
                <Box sx={{ height: '100%', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" sx={{ opacity: 0.5 }}>Map unavailable — API key missing</Typography>
                </Box>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Zone controls */}
        <Grid item xs={12} md={5}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={0.25}>Zone Overrides</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                Override the general KL rate for specific areas.
              </Typography>
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
      </>
      )}
    </Box>
  );
}
