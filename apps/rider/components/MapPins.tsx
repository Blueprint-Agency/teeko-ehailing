import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

// Rendered as SVG (not nested RN Views) because react-native-maps on Android
// snapshots Marker children using the view's layout bounds — View shadows,
// elevation, and anti-aliased rounded edges paint outside that box and get
// clipped. The SVG canvas is captured whole. `collapsable={false}` keeps RN
// Android from flattening the wrapper.
//
// Canvas size is kept ≈ the visible dot's bounding box (no oversized
// transparent padding) to avoid a faint square artefact some Android
// Marker bitmap pipelines show around the transparent margin.

// Pickup: black dot inside a soft white halo.
export function PickupPin() {
  const size = 32;
  return (
    <View collapsable={false} style={{ width: size, height: size, backgroundColor: 'transparent' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={16} cy={17} r={14} fill="rgba(0,0,0,0.15)" />
        <Circle cx={16} cy={16} r={13} fill="rgba(255,255,255,0.9)" />
        <Circle cx={16} cy={16} r={8} fill="#FFFFFF" />
        <Circle cx={16} cy={16} r={5} fill="#111111" />
      </Svg>
    </View>
  );
}

export interface DestinationPinProps {
  /** Retained for API compatibility; no longer rendered — the simple dot
   *  design omits the pulse ring. */
  pulse?: boolean;
}

// Destination: red dot inside a white ring.
export function DestinationPin(_props: DestinationPinProps = {}) {
  const size = 32;
  return (
    <View collapsable={false} style={{ width: size, height: size, backgroundColor: 'transparent' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={16} cy={17} r={14} fill="rgba(0,0,0,0.15)" />
        <Circle cx={16} cy={16} r={13} fill="#FFFFFF" />
        <Circle cx={16} cy={16} r={8} fill="#16A34A" />
      </Svg>
    </View>
  );
}
