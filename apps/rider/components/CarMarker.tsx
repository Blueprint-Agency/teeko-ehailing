import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export interface CarMarkerProps {
  /** Kept for API compatibility; the dot doesn't visually rotate. */
  heading?: number;
  variant?: 'approaching' | 'intrip' | 'nearby';
  size?: number;
}

// Simple red dot for every driver variant — sized to convey hierarchy:
// nearby < approaching < intrip. Rendered as SVG (not nested Views) so
// react-native-maps' Android bitmap snapshot captures the whole canvas
// without clipping shadows/edges. `collapsable={false}` stops RN Android
// from flattening the wrapper away.
export function CarMarker({
  variant = 'approaching',
  size: sizeProp,
}: CarMarkerProps) {
  const isIntrip = variant === 'intrip';
  const isNearby = variant === 'nearby';
  const size = sizeProp ?? (isNearby ? 18 : 24);

  const dotFill = '#E11D2E';
  const ringFill = '#FFFFFF';
  const haloOpacity = isNearby ? 0.1 : 0.16;

  const cx = size / 2;
  const cy = size / 2;
  const ringR = size / 2 - 1;
  const haloR = ringR + 1;
  const dotR = Math.max(3, ringR - 3);

  return (
    <View collapsable={false} style={{ width: size, height: size, backgroundColor: 'transparent' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cy + 1} r={haloR} fill={`rgba(0,0,0,${haloOpacity})`} />
        <Circle cx={cx} cy={cy} r={ringR} fill={ringFill} />
        <Circle cx={cx} cy={cy} r={dotR} fill={dotFill} />
      </Svg>
    </View>
  );
}
