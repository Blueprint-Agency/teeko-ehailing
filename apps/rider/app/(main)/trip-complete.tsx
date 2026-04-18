import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { useTripStore, useUIStore } from '@teeko/api';
import { Button, Input, Rating, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { DriverCard } from '../../components/DriverCard';
import { FareReveal } from '../../components/FareReveal';

export default function TripCompleteScreen() {
  const router = useRouter();
  const trip = useTripStore((s) => s.trip);
  const driver = useTripStore((s) => s.driver);
  const rateTrip = useTripStore((s) => s.rateTrip);
  const pushToast = useUIStore((s) => s.pushToast);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (trip?.fare?.amountMyr != null) {
      pushToast({
        kind: 'success',
        message: `You've arrived! Your fare is RM ${trip.fare.amountMyr.toFixed(2)}.`,
      });
    }
  }, [pushToast, trip?.fare?.amountMyr]);

  const canSubmit = rating >= 1 && !submitted;

  const onDone = () => {
    if (!canSubmit) return;
    setSubmitted(true);
    rateTrip(rating, comment.trim() || undefined);
    router.dismissAll();
    router.replace('/(main)/(tabs)');
  };

  if (!trip || !driver) {
    return (
      <ScreenContainer>
        <Text weight="bold" className="text-2xl">Trip completed</Text>
        <Text tone="secondary" className="mt-2">No active trip. Head back to Home.</Text>
        <View className="mt-6">
          <Button label="Back to Home" onPress={() => router.replace('/(main)/(tabs)')} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Text weight="bold" className="text-2xl text-ink-primary">
          Trip completed
        </Text>

        <View className="mt-8">
          <FareReveal amountMyr={trip.fare.amountMyr} />
        </View>

        <View className="mt-8 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <DriverCard driver={driver} compact />
        </View>

        <View className="mt-6 items-center">
          <Text weight="bold" className="text-base text-ink-primary">
            How was your ride with {driver.name.split(' ')[0]}?
          </Text>
          <View className="mt-3">
            <Rating value={rating} onChange={setRating} />
          </View>
        </View>

        <View className="mt-6">
          <Input
            label="Comment (optional)"
            value={comment}
            onChangeText={setComment}
            placeholder="Leave a comment (optional)"
            multiline
          />
        </View>
      </ScrollView>

      <View className="pb-2 pt-3">
        <Button label="Done" onPress={onDone} disabled={!canSubmit} />
      </View>
    </ScreenContainer>
  );
}
