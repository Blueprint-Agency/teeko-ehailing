// @teeko/ui — rider+driver shared UI primitives (NativeWind-styled).
// See docs/v0.1/plans/rider-mockup/02-design-system.md §4 for the full component inventory.

export { BottomSheet, type BottomSheetHandle, type BottomSheetProps } from './primitives/BottomSheet';
export { Button, type ButtonProps } from './primitives/Button';
export { Card, type CardProps } from './primitives/Card';
export { Icon, type IconProps, type IconName } from './primitives/Icon';
export { Input, type InputProps } from './primitives/Input';
export { ListRow, type ListRowProps } from './primitives/ListRow';
export { OTPInput, type OTPInputProps } from './primitives/OTPInput';
export { Pill, type PillProps } from './primitives/Pill';
export { Pressable, type PressableProps, type HapticStyle } from './primitives/Pressable';
export { Rating, type RatingProps } from './primitives/Rating';
export { RatingPill, type RatingPillProps } from './primitives/RatingPill';
export { ScreenContainer, type ScreenContainerProps } from './primitives/ScreenContainer';
export { Spinner, type SpinnerProps } from './primitives/Spinner';
export { Text, type TextProps } from './primitives/Text';

export { cn } from './utils/cn';

export const UI_PACKAGE_VERSION = '0.1.0';
