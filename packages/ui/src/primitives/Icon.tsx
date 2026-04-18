import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

/**
 * Icon wrapper using @expo/vector-icons MaterialIcons.
 *
 * v0.1 note: MaterialIcons covers the name-set we need (home, directions_car,
 * person, chevron_right, search, etc.) and is bundled with Expo so it needs
 * zero extra install. It's visually close to — but not identical to — the
 * Material Symbols Outlined variable font used in the Stitch mockups.
 * If we later want true FILL-variation support, swap this component for one
 * that loads the Material Symbols variable font via @expo-google-fonts.
 */
export type IconName = ComponentProps<typeof MaterialIcons>['name'];

export interface IconProps {
  name: IconName;
  size?: number;
  /** Tailwind text color class (`text-ink-primary`, `text-primary`, etc.). Ignored if `color` is given. */
  className?: string;
  /** Raw color override — bypasses className. */
  color?: string;
  /** Emulates Material Symbols `FILL 1` by using a filled variant of the glyph when available. Best-effort. */
  filled?: boolean;
}

// MaterialIcons has many names but not separate fill variants. For a few common
// icons, swap to a visibly-filled alternative name when `filled` is true.
// MaterialIcons uses kebab-case names (e.g. 'favorite-border' → 'favorite').
const filledAlias: Partial<Record<string, string>> = {
  'favorite-border': 'favorite',
  'bookmark-border': 'bookmark',
  'star-outline': 'star',
};

export function Icon({ name, size = 24, className, color, filled }: IconProps) {
  const glyph = filled && filledAlias[name as string] ? (filledAlias[name as string] as IconName) : name;
  return <MaterialIcons name={glyph} size={size} color={color} className={className} />;
}
