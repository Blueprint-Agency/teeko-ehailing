import { useLocalSearchParams } from 'expo-router';

import { NotImplementedScreen, type NotImplementedDomain } from '../../components/NotImplementedScreen';

const VALID_DOMAINS: NotImplementedDomain[] = ['home', 'rides', 'trips', 'payments', 'search'];

function toDomain(raw: string | undefined): NotImplementedDomain {
  if (raw && (VALID_DOMAINS as string[]).includes(raw)) {
    return raw as NotImplementedDomain;
  }
  return 'rides';
}

export default function NotImplementedRoute() {
  const { domain } = useLocalSearchParams<{ domain?: string }>();
  return <NotImplementedScreen domain={toDomain(domain)} />;
}
