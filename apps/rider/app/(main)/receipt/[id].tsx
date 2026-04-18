import { useLocalSearchParams } from 'expo-router';

import { ScreenContainer, Text } from '@teeko/ui';

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ScreenContainer>
      <Text weight="bold" className="text-2xl">Receipt</Text>
      <Text tone="secondary" className="mt-1">PRD §4.11 — trip id: {id ?? '—'}</Text>
    </ScreenContainer>
  );
}
