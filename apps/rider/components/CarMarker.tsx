import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Car } from 'lucide-react-native';

export interface CarMarkerProps {
  /** Kept for API compatibility; the marker doesn't visually rotate. */
  heading?: number;
  variant?: 'approaching' | 'intrip' | 'nearby';
  size?: number;
}

// Ambient online drivers (`nearby`) render as a car glyph in a white badge so
// they read as "cars around you" on the home map. The matched-driver dots
// (`approaching`/`intrip`) stay as simple dots — that flow has tuned Android
// bitmap-snapshot behaviour we don't want to disturb.
export function CarMarker({
  variant = 'approaching',
  size: sizeProp,
}: CarMarkerProps) {
  const isIntrip = variant === 'intrip';
  const isNearby = variant === 'nearby';

  if (isNearby) {
    // White circular badge + red car. Background circle and the lucide car are
    // both SVG-backed and sit fully inside the wrapper's bounds, so Android's
    // Marker bitmap snapshot captures them without clipping. `collapsable={false}`
    // keeps RN Android from flattening the wrapper away.
    const badge = sizeProp ?? 28;
    const r = badge / 2;
    return (
      <View
        collapsable={false}
        style={{
          width: badge,
          height: badge,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        }}
      >
        <Svg
          width={badge}
          height={badge}
          viewBox={`0 0 ${badge} ${badge}`}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {/* soft drop shadow */}
          <Circle cx={r} cy={r + 0.5} r={r - 1} fill="rgba(0,0,0,0.16)" />
          {/* white badge */}
          <Circle cx={r} cy={r} r={r - 2} fill="#FFFFFF" />
        </Svg>
        <Car size={Math.round(badge * 0.58)} color="#E11D2E" strokeWidth={2.25} />
      </View>
    );
  }

  const size = sizeProp ?? 24;

  const dotFill = '#E11D2E';
  const ringFill = '#FFFFFF';
  const haloOpacity = 0.16;

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
