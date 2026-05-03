import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/modules/riders/repo', () => ({
  listSavedPlacesForUser: vi.fn(),
  upsertSavedPlace: vi.fn(),
  deleteSavedPlaceForUser: vi.fn(),
  listRecentPlacesForUser: vi.fn(),
  pushRecentPlaceForUser: vi.fn(),
}));

import * as repo from '../../src/modules/riders/repo';
import { ridersService } from '../../src/modules/riders/service';

describe('ridersService.listSavedPlaces', () => {
  it('maps stored rows to the wire Place shape with category', async () => {
    vi.mocked(repo.listSavedPlacesForUser).mockResolvedValue([
      { id: 'a', label: 'home', address: '1 KLCC', lat: 3.158, lng: 101.711 },
      { id: 'b', label: 'work', address: 'Mont Kiara', lat: 3.171, lng: 101.651 },
      { id: 'c', label: 'custom', address: 'Mid Valley', lat: 3.118, lng: 101.677 },
    ]);
    const out = await ridersService.listSavedPlaces('user-1');
    expect(out).toEqual([
      { id: 'a', name: '1 KLCC', address: '1 KLCC', lat: 3.158, lng: 101.711, category: 'home' },
      { id: 'b', name: 'Mont Kiara', address: 'Mont Kiara', lat: 3.171, lng: 101.651, category: 'work' },
      { id: 'c', name: 'Mid Valley', address: 'Mid Valley', lat: 3.118, lng: 101.677, category: 'saved' },
    ]);
  });
});

describe('ridersService.upsertSavedPlace', () => {
  it('passes through to repo with the right label', async () => {
    vi.mocked(repo.upsertSavedPlace).mockResolvedValue({
      id: 'new', label: 'home', address: '1 KLCC', lat: 3.158, lng: 101.711,
    });
    const out = await ridersService.upsertSavedPlace('user-1', {
      label: 'home', address: '1 KLCC', lat: 3.158, lng: 101.711,
    });
    expect(repo.upsertSavedPlace).toHaveBeenCalledWith({
      userId: 'user-1', label: 'home', address: '1 KLCC', lat: 3.158, lng: 101.711,
    });
    expect(out.category).toBe('home');
  });
});

describe('ridersService.pushRecentPlace', () => {
  it('passes through to repo and returns recent-categorized Place', async () => {
    vi.mocked(repo.pushRecentPlaceForUser).mockResolvedValue({
      id: 'r1', label: 'Suria KLCC', address: '1 KLCC', lat: 3.158, lng: 101.711,
    });
    const out = await ridersService.pushRecentPlace('user-1', {
      label: 'Suria KLCC', address: '1 KLCC', lat: 3.158, lng: 101.711,
    });
    expect(out).toEqual({
      id: 'r1', name: 'Suria KLCC', address: '1 KLCC', lat: 3.158, lng: 101.711, category: 'recent',
    });
  });
});
