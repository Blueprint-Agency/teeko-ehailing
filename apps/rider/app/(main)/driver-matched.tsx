import { ScreenContainer, Text } from '@teeko/ui';

export default function DriverMatchedScreen() {
  return (
    <ScreenContainer>
      <Text weight="bold" className="text-2xl">Driver matched</Text>
      <Text tone="secondary" className="mt-1">PRD §4.7 / §4.8 — placeholder (view switches on trip.status)</Text>
    </ScreenContainer>
  );
}
