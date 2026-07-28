'use client';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Stack,
  List, ListItem, ListItemText, Divider, CircularProgress, Alert,
} from '@mui/material';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, LiveTrip } from '@/lib/api';

const KL_CENTER = { lat: 3.1478, lng: 101.6953 };
const POLL_MS = 10000;

const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const STATUS_LABEL: Record<LiveTrip['status'], string> = {
  matched: 'En route to pickup',
  driver_arrived: 'At pickup',
  in_trip: 'In trip',
};

const pinColor = (category: string) => (category === 'Premium' ? '#9c27b0' : '#1976d2');

const markerIcon = (color: string, faded: boolean) =>
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30" opacity="${faded ? 0.55 : 1}">` +
      `<path d="M11 0C5 0 0 4.7 0 10.5 0 18 11 30 11 30s11-12 11-19.5C22 4.7 17 0 11 0z" fill="${color}" stroke="#fff" stroke-width="2"/>` +
      `<circle cx="11" cy="10.5" r="4" fill="#fff"/></svg>`,
  );

export default function LiveTripMapPage() {
  const router = useRouter();
  const [pins, setPins] = useState<LiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      setPins(await adminApi.getLiveTrips());
      setError('');
      setTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load live trips');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Live Trip Map</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={`${pins.length} active trips`} color="success" size="small" />
          <Chip label={`Refreshed ${tick}×`} size="small" variant="outlined" />
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {!MAPS_API_KEY && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to render the map.
        </Alert>
      )}
      <Grid container spacing={2}>
        {/* Map */}
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ height: 480, borderRadius: 1, overflow: 'hidden', position: 'relative' }}>
              {MAPS_API_KEY ? (
                <APIProvider apiKey={MAPS_API_KEY}>
                  <Map
                    defaultCenter={KL_CENTER}
                    defaultZoom={12}
                    gestureHandling="greedy"
                    disableDefaultUI
                    style={{ width: '100%', height: '100%' }}
                  >
                    {pins.map((pin) => (
                      <Marker
                        key={pin.id}
                        position={{ lat: pin.lat, lng: pin.lng }}
                        onClick={() => router.push(`/trips/${pin.id}`)}
                        title={`${pin.driver} · ${STATUS_LABEL[pin.status]}${pin.live ? '' : ' (pickup)'}`}
                        icon={markerIcon(pinColor(pin.category), !pin.live)}
                      />
                    ))}
                  </Map>
                </APIProvider>
              ) : (
                <Box sx={{ height: '100%', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" sx={{ opacity: 0.5 }}>Map unavailable — API key missing</Typography>
                </Box>
              )}
              {loading && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.4)' }}>
                  <CircularProgress size={28} />
                </Box>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Trip list */}
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Active Trips</Typography>
              {!loading && pins.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No trips in progress.</Typography>
              ) : (
                <List dense disablePadding>
                  {pins.map((pin, i) => (
                    <Box key={pin.id}>
                      {i > 0 && <Divider sx={{ my: 0.5 }} />}
                      <ListItem
                        disablePadding sx={{ py: 0.5, cursor: 'pointer' }}
                        onClick={() => router.push(`/trips/${pin.id}`)}
                      >
                        <ListItemText
                          primary={<><strong>{pin.driver}</strong> · <Chip label={pin.category} size="small" sx={{ fontSize: 10 }} /></>}
                          secondary={`${pin.pickup ?? 'Pickup'} → ${pin.dropoff ?? 'Dropoff'} · ${STATUS_LABEL[pin.status]}`}
                          primaryTypographyProps={{ fontSize: 12 }}
                          secondaryTypographyProps={{ fontSize: 11 }}
                        />
                      </ListItem>
                    </Box>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
