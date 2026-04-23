import { Redirect } from 'expo-router';

// In v1.0: read role from auth store and redirect accordingly.
// In v0.1 mockup: go directly to login.
export default function Root() {
  return <Redirect href="/(auth)/login" />;
}
