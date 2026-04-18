import type { Place } from '@teeko/shared';

import { simulateLatency } from '../delay';
import placesJson from '../data/places.json';
import recentIds from '../data/recent-places.json';

const places = placesJson as Place[];

export async function searchPlaces(query: string): Promise<Place[]> {
  await simulateLatency(200, 600);
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (q === 'nothing') return [];
  return places.filter(
    (p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q),
  );
}

export async function recentPlaces(): Promise<Place[]> {
  await simulateLatency(200, 500);
  return (recentIds as string[])
    .map((id) => places.find((p) => p.id === id))
    .filter((p): p is Place => Boolean(p));
}

export async function savedPlaces(): Promise<Place[]> {
  await simulateLatency(200, 500);
  return places.filter((p) => p.category === 'home' || p.category === 'work');
}

export async function placeById(id: string): Promise<Place | undefined> {
  await simulateLatency(100, 250);
  return places.find((p) => p.id === id);
}
