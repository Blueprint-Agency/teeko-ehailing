import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { Icon } from '@teeko/ui';

// Three pulsing concentric circles behind a car icon.
export function SearchingIndicator() {
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = rings.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(v, {
            toValue: 1,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="h-48 w-48 items-center justify-center">
      {rings.map((v, i) => {
        const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] });
        const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              width: 80,
              height: 80,
              borderRadius: 9999,
              backgroundColor: '#E11D2E',
              opacity,
              transform: [{ scale }],
            }}
          />
        );
      })}
      <View className="h-20 w-20 items-center justify-center rounded-full bg-primary">
        <Icon name="directions-car" size={36} color="#FFFFFF" />
      </View>
    </View>
  );
}
