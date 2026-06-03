'use client';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Stack,
  List, ListItem, ListItemText, Divider,
} from '@mui/material';
import { useTripStore } from '@/stores/trip';
import { useDriverStore } from '@/stores/driver';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const KL_CENTER = { lat: 3.1478, lng: 101.6953 };
const CATEGORIES = ['Standard', 'Premium', 'Economy'];

const LIVE_PINS = [
  { id: 'lp1', tripId: 't9',  driver: 'Vijayakumar',  pickup: 'IOI Mall',         dropoff: 'Puchong Utama', lat: 3.0370, lng: 101.6183, category: 'Standard', duration: '4 min' },
  { id: 'lp2', tripId: 't16', driver: 'Farah Liyana',  pickup: 'Brickfields',      dropoff: 'Cheras',        lat: 3.1314, lng: 101.6855, category: 'Standard', duration: '12 min' },
  { id: 'lp3', tripId: 't20', driver: 'Tengku Aidil',  pickup: 'Sri Hartamas',     dropoff: 'Duta',          lat: 3.1724, lng: 101.6486, category: 'Premium',  duration: '8 min' },
];

export default function LiveTripMapPage() {
  const trips = useTripStore((s) => s.trips);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const activeTrips = trips.filter((t) => t.status === 'in_progress');
  const router = useRouter();

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Live Trip Map</Typography>
        <Stack direction="row" spacing={1}>
          <Chip label={`${activeTrips.length} active trips`} color="success" size="small" />
          <Chip label={`Updated ${tick} ticks ago`} size="small" variant="outlined" />
        </Stack>
      </Box>

      <Grid container spacing={2}>
        {/* Map placeholder */}
        <Grid item xs={12} md={8}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <Box
              sx={{
                height: 480,
                bgcolor: 'action.hover',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 1,
              }}
            >
              {/* Stylised map grid */}
              <Box sx={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(128,128,128,0.15) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(128,128,128,0.15) 40px)' }} />
              <Typography variant="h4" sx={{ opacity: 0.15, fontWeight: 700, letterSpacing: -1 }}>Kuala Lumpur</Typography>
              <Typography variant="caption" sx={{ opacity: 0.5, mt: 1 }}>
                Google Maps API key required — add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local
              </Typography>

              {/* Animated pins */}
              {LIVE_PINS.map((pin, i) => (
                <Box
                  key={pin.id}
                  sx={{
                    position: 'absolute',
                    top: `${30 + i * 22}%`,
                    left: `${20 + i * 25 + (tick % 3)}%`,
                    cursor: 'pointer',
                    transition: 'left 5s ease-in-out',
                  }}
                  onClick={() => router.push(`/trips/${pin.tripId}`)}
                >
                  <Stack alignItems="center">
                    <Box sx={{
                      px: 1, py: 0.25, bgcolor: pin.category === 'Premium' ? 'secondary.main' : 'primary.main',
                      borderRadius: 1, color: '#fff',
                    }}>
                      <Typography variant="caption" fontWeight={700} sx={{ fontSize: 10 }}>{pin.driver}</Typography>
                    </Box>
                    <Box sx={{ width: 2, height: 8, bgcolor: 'primary.main' }} />
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
                  </Stack>
                </Box>
              ))}
            </Box>
          </Card>
        </Grid>

        {/* Trip list */}
        <Grid item xs={12} md={4}>
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} mb={1.5}>Active Trips</Typography>
              <List dense disablePadding>
                {LIVE_PINS.map((pin, i) => (
                  <Box key={pin.id}>
                    {i > 0 && <Divider sx={{ my: 0.5 }} />}
                    <ListItem
                      disablePadding sx={{ py: 0.5, cursor: 'pointer' }}
                      onClick={() => router.push(`/trips/${pin.tripId}`)}
                    >
                      <ListItemText
                        primary={<><strong>{pin.driver}</strong> · <Chip label={pin.category} size="small" sx={{ fontSize: 10 }} /></>}
                        secondary={`${pin.pickup} → ${pin.dropoff} · ETA ${pin.duration}`}
                        primaryTypographyProps={{ fontSize: 12 }}
                        secondaryTypographyProps={{ fontSize: 11 }}
                      />
                    </ListItem>
                  </Box>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
