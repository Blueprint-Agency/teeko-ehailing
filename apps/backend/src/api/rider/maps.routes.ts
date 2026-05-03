import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { MapsError, mapsService } from '../../modules/maps';
import { ridersService } from '../../modules/riders';

const SavePlaceBody = z.object({
  label: z.enum(['home', 'work', 'custom']),
  address: z.string().min(1).max(500),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

const RecentPlaceBody = z.object({
  label: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

const SearchQuery = z.object({
  q: z.string().min(2).max(200),
  lat: z.coerce.number().gte(-90).lte(90).optional(),
  lng: z.coerce.number().gte(-180).lte(180).optional(),
});

const DetailsQuery = z.object({
  placeId: z.string().min(1).max(500),
});

export async function routes(app: FastifyInstance) {
  // ---- saved ----
  app.get('/places/saved', async (req) => {
    return ridersService.listSavedPlaces(req.user!.id);
  });

  app.post('/places/saved', async (req) => {
    const input = SavePlaceBody.parse(req.body);
    return ridersService.upsertSavedPlace(req.user!.id, input);
  });

  app.delete<{ Params: { id: string } }>('/places/saved/:id', async (req, reply) => {
    await ridersService.deleteSavedPlace(req.user!.id, req.params.id);
    return reply.code(204).send();
  });

  // ---- recent ----
  app.get('/places/recent', async (req) => {
    return ridersService.listRecentPlaces(req.user!.id);
  });

  app.post('/places/recent', async (req) => {
    const input = RecentPlaceBody.parse(req.body);
    return ridersService.pushRecentPlace(req.user!.id, input);
  });

  // ---- google proxy ----
  app.get('/places/search', async (req, reply) => {
    const query = SearchQuery.parse(req.query);
    try {
      const predictions = await mapsService.autocomplete({
        q: query.q,
        near:
          query.lat !== undefined && query.lng !== undefined
            ? { lat: query.lat, lng: query.lng }
            : undefined,
      });
      // Predictions don't have lat/lng yet — caller resolves via /places/details.
      return predictions.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        lat: 0,
        lng: 0,
        category: 'search' as const,
      }));
    } catch (err) {
      if (err instanceof MapsError) {
        return reply.code(err.statusCode).send({ error: 'maps_unavailable' });
      }
      throw err;
    }
  });

  app.get('/places/details', async (req, reply) => {
    const query = DetailsQuery.parse(req.query);
    try {
      const place = await mapsService.placeDetails(query.placeId);
      return {
        id: place.id,
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        category: 'search' as const,
      };
    } catch (err) {
      if (err instanceof MapsError) {
        return reply.code(err.statusCode).send({ error: 'maps_unavailable' });
      }
      throw err;
    }
  });
}
