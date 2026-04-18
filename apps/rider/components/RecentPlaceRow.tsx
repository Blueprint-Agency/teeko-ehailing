import type { Place } from '@teeko/shared';
import { ListRow } from '@teeko/ui';

export interface RecentPlaceRowProps {
  place: Place;
  onPress: (place: Place) => void;
}

export function RecentPlaceRow({ place, onPress }: RecentPlaceRowProps) {
  return (
    <ListRow
      onPress={() => onPress(place)}
      leadingIcon="history"
      title={place.name}
      subtitle={place.address}
    />
  );
}
