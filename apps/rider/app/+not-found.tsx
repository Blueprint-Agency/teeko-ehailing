import { Link } from 'expo-router';

import { ScreenContainer, Text } from '@teeko/ui';

export default function NotFound() {
  return (
    <ScreenContainer>
      <Text weight="bold" className="text-2xl">Not found</Text>
      <Text tone="secondary" className="mt-1">This route does not exist.</Text>
      <Link href="/" className="mt-4 text-primary">Go home</Link>
    </ScreenContainer>
  );
}
