import { ActivityIndicator, type ActivityIndicatorProps } from 'react-native';

export interface SpinnerProps extends ActivityIndicatorProps {}

export function Spinner({ size = 'small', color = '#E11D2E', ...rest }: SpinnerProps) {
  return <ActivityIndicator size={size} color={color} {...rest} />;
}
