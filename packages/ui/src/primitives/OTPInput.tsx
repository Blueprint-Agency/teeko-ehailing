import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  NativeSyntheticEvent,
  TextInput,
  TextInputKeyPressEventData,
  View,
} from 'react-native';

import { cn } from '../utils/cn';
import { Text } from './Text';

export interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  error?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  error,
  autoFocus = true,
  className,
}: OTPInputProps) {
  const refs = useRef<Array<TextInput | null>>([]);
  const shake = useRef(new Animated.Value(0)).current;
  const [focusIndex, setFocusIndex] = useState(autoFocus ? 0 : -1);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => refs.current[0]?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  useEffect(() => {
    if (error) {
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 60, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 1, duration: 60, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      ]).start();
    }
  }, [error, shake]);

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] });

  const handleChange = (index: number, text: string) => {
    const digits = text.replace(/\D/g, '');
    if (!digits) {
      // Backspace path handled by onKeyPress; still allow clearing via empty input.
      const next = value.slice(0, index) + value.slice(index + 1);
      onChange(next);
      return;
    }
    // Support paste of multiple digits in one box.
    const nextChars = digits.split('');
    let next = value.split('');
    for (let i = 0; i < nextChars.length && index + i < length; i += 1) {
      next[index + i] = nextChars[i]!;
    }
    const joined = next.join('').slice(0, length);
    onChange(joined);
    const nextFocus = Math.min(index + nextChars.length, length - 1);
    refs.current[nextFocus]?.focus();
    if (joined.length === length) {
      Keyboard.dismiss();
      onComplete?.(joined);
    }
  };

  const handleKeyPress = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
      const next = value.slice(0, index - 1) + value.slice(index);
      onChange(next);
    }
  };

  const cells = Array.from({ length }, (_, i) => {
    const char = value[i] ?? '';
    const isFocused = focusIndex === i;
    return (
      <TextInput
        key={i}
        ref={(el) => {
          refs.current[i] = el;
        }}
        value={char}
        onChangeText={(t) => handleChange(i, t)}
        onKeyPress={(e) => handleKeyPress(i, e)}
        onFocus={() => setFocusIndex(i)}
        onBlur={() => setFocusIndex(-1)}
        keyboardType="number-pad"
        maxLength={length}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        selectTextOnFocus
        className={cn(
          'h-14 w-12 rounded-lg border text-center text-2xl font-headline text-ink-primary',
          error
            ? 'border-danger bg-primary-50'
            : isFocused
              ? 'border-primary bg-surface'
              : 'border-border bg-muted',
        )}
      />
    );
  });

  return (
    <View className={className}>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        className="flex-row items-center justify-between"
      >
        {cells}
      </Animated.View>
      {error ? (
        <Text tone="danger" className="mt-2 text-center text-xs">
          Code didn't match. Try again.
        </Text>
      ) : null}
    </View>
  );
}
