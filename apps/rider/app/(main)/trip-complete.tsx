import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTripStore } from '@teeko/api';
import { Button, Icon, Pressable, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { FareReveal } from '../../components/FareReveal';

export default function TripCompleteScreen() {
  const router = useRouter();
  const trip = useTripStore((s) => s.trip);
  const driver = useTripStore((s) => s.driver);
  const destination = useTripStore((s) => s.destination);
  const rateTrip = useTripStore((s) => s.rateTrip);

  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');

  const fare = trip?.fare?.amountMyr ?? 0;

  const handleDone = () => {
    rateTrip(stars > 0 ? stars : 5, comment.trim() || undefined);
    router.replace('/(main)/(tabs)');
  };

  return (
    <SafeAreaView className="flex-1 bg-surface px-gutter">
      <View className="flex-1 gap-8 pt-12">
        {/* Success icon */}
        <View className="items-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-50">
            <Icon name="check-circle" size={48} color="#E11D2E" />
          </View>
          <Text weight="bold" className="mt-4 text-2xl">
            You've arrived!
          </Text>
          {destination ? (
            <Text tone="secondary" className="mt-1 text-center text-sm" numberOfLines={2}>
              {destination.name}
            </Text>
          ) : null}
        </View>

        {/* Fare */}
        <FareReveal amountMyr={fare} label="Trip fare" />

        {/* Rating */}
        <View className="items-center gap-3">
          <Text weight="medium" className="text-base">
            How was your ride
            {driver ? ` with ${driver.name.split(' ')[0]}` : ''}?
          </Text>
          <View className="flex-row gap-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setStars(n)}
                haptic="selection"
                accessibilityRole="button"
                accessibilityLabel={`${n} star`}
              >
                <Icon name="star" size={36} color={n <= stars ? '#F5A524' : '#E5E7EB'} />
              </Pressable>
            ))}
          </View>

          {stars > 0 && stars <= 3 ? (
            <TextInput
              placeholder="Tell us what went wrong (optional)"
              value={comment}
              onChangeText={setComment}
              className="w-full rounded-lg border border-border px-4 py-3 text-sm"
              multiline
              numberOfLines={3}
              placeholderTextColor="#9CA3AF"
            />
          ) : null}
        </View>
      </View>

      <View className="pb-4">
        <Button
          label={stars > 0 ? 'Submit & finish' : 'Skip rating'}
          onPress={handleDone}
        />
      </View>
    </SafeAreaView>
  );
}
