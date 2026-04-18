import type { Place, PlaceCategory } from '@teeko/shared';
import { type IconName, ListRow } from '@teeko/ui';

export interface SavedPlaceRowProps {
  kind: Extract<PlaceCategory, 'home' | 'work'>;
  place?: Place;
  onPress: (kind: 'home' | 'work', place?: Place) => void;
}

const meta: Record<'home' | 'work', { icon: IconName; label: string; emptyCta: string }> = {
  home: { icon: 'home', label: 'Home', emptyCta: 'Enter home location' },
  work: { icon: 'work', label: 'Work', emptyCta: 'Enter work location' },
};

export function SavedPlaceRow({ kind, place, onPress }: SavedPlaceRowProps) {
  const m = meta[kind];
  return (
    <ListRow
      onPress={() => onPress(kind, place)}
      leadingIcon={m.icon}
      title={m.label}
      subtitle={place ? place.address : m.emptyCta}
    />
  );
}
