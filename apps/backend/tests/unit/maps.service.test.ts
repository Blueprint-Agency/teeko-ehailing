import { afterEach, describe, expect, it, vi } from 'vitest';

import { mapsService } from '../../src/modules/maps/service';

const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe('mapsService.autocomplete', () => {
  it('normalizes Google predictions into { id, name, address }', async () => {
    const googleResponse = {
      suggestions: [
        {
          placePrediction: {
            placeId: 'ChIJabc',
            text: { text: 'Suria KLCC, Kuala Lumpur, Malaysia' },
            structuredFormat: {
              mainText: { text: 'Suria KLCC' },
              secondaryText: { text: 'Kuala Lumpur, Malaysia' },
            },
          },
        },
      ],
    };
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify(googleResponse), { status: 200 }),
    ) as unknown as typeof fetch;

    const out = await mapsService.autocomplete({ q: 'klcc' });

    expect(out).toEqual([
      { id: 'ChIJabc', name: 'Suria KLCC', address: 'Kuala Lumpur, Malaysia' },
    ]);
  });

  it('passes location bias when near is provided', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ suggestions: [] }), { status: 200 }),
    ) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    await mapsService.autocomplete({ q: 'klcc', near: { lat: 3.158, lng: 101.711 } });

    const call = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.locationBias).toEqual({
      circle: {
        center: { latitude: 3.158, longitude: 101.711 },
        radius: 50000,
      },
    });
  });

  it('throws MapsError on Google 5xx', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('upstream error', { status: 503 }),
    ) as unknown as typeof fetch;
    await expect(mapsService.autocomplete({ q: 'klcc' })).rejects.toMatchObject({
      name: 'MapsError',
      statusCode: 502,
    });
  });
});
