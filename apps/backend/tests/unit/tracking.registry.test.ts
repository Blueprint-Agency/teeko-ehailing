import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { trackingService } from '../../src/modules/tracking/service';
import * as socketio from '../../src/config/socketio';
import * as googleMaps from '../../src/external/googleMaps';

// Minimal stand-in for a socket.io Socket — the registry only reads id/connected
// and calls emit.
function fakeSocket(id: string, connected = true) {
  return { id, connected, emit: vi.fn() } as never as Parameters<
    typeof trackingService.registerDriver
  >[1];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('driver socket registry ownership', () => {
  it('a stale disconnect does not unregister the socket that superseded it', () => {
    const oldSocket = fakeSocket('sid-old');
    const newSocket = fakeSocket('sid-new');

    trackingService.registerDriver('driver-1', oldSocket);
    // Reconnect: the new socket registers before the old one's disconnect lands.
    trackingService.registerDriver('driver-1', newSocket);

    const owned = trackingService.unregisterDriver('driver-1', 'sid-old');

    expect(owned).toBe(false);
    expect(trackingService.getDriverSocket('driver-1')).toBe(newSocket);
    expect(trackingService.hasDriverSocket('driver-1')).toBe(true);
  });

  it('the owning socket disconnecting does clear the entry', () => {
    const socket = fakeSocket('sid-1');
    trackingService.registerDriver('driver-2', socket);

    const owned = trackingService.unregisterDriver('driver-2', 'sid-1');

    expect(owned).toBe(true);
    expect(trackingService.getDriverSocket('driver-2')).toBeUndefined();
    expect(trackingService.hasDriverSocket('driver-2')).toBe(false);
  });

  it('applies the same guard to riders', () => {
    trackingService.registerRider('rider-1', fakeSocket('sid-old'));
    const newSocket = fakeSocket('sid-new');
    trackingService.registerRider('rider-1', newSocket);

    expect(trackingService.unregisterRider('rider-1', 'sid-old')).toBe(false);
    expect(trackingService.getRiderSocket('rider-1')).toBe(newSocket);
  });
});

describe('emitToDriver', () => {
  it('falls back to the driver room when the map entry is missing', () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    vi.spyOn(socketio, 'getIO').mockReturnValue({ to } as never);

    trackingService.unregisterDriver('driver-3');
    const delivered = trackingService.emitToDriver('driver-3', 'trip.request', { a: 1 });

    expect(delivered).toBe(true);
    expect(to).toHaveBeenCalledWith('driver:driver-3');
    expect(emit).toHaveBeenCalledWith('trip.request', { a: 1 });
  });

  it('reports failure when there is no socket and no io', () => {
    vi.spyOn(socketio, 'getIO').mockReturnValue(null);
    trackingService.unregisterDriver('driver-4');

    expect(trackingService.emitToDriver('driver-4', 'trip.request', {})).toBe(false);
  });
});

describe('getEtaMinutesCached', () => {
  const from = { lat: 3.15, lng: 101.71 };
  const to = { lat: 3.16, lng: 101.72 };

  beforeEach(async () => {
    // Drop any cache entry left by a previous test.
    await trackingService.removeDriverLocation('driver-eta');
  });

  it('calls Distance Matrix once and serves repeats from cache', async () => {
    const spy = vi
      .spyOn(googleMaps, 'getDistanceMatrix')
      .mockResolvedValue({ durationSeconds: 300, distanceMeters: 1000 } as never);

    const a = await trackingService.getEtaMinutesCached('driver-eta', from, to);
    const b = await trackingService.getEtaMinutesCached('driver-eta', from, to);
    const c = await trackingService.getEtaMinutesCached('driver-eta', from, to);

    expect([a, b, c]).toEqual([5, 5, 5]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('recomputes once the entry is evicted', async () => {
    const spy = vi
      .spyOn(googleMaps, 'getDistanceMatrix')
      .mockResolvedValue({ durationSeconds: 300, distanceMeters: 1000 } as never);

    await trackingService.getEtaMinutesCached('driver-eta', from, to);
    await trackingService.removeDriverLocation('driver-eta');
    await trackingService.getEtaMinutesCached('driver-eta', from, to);

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
