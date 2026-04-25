import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../components/ThemeProvider';
import { useColors } from '../constants/colors';
import { LocaleProvider } from '../providers/LocaleProvider';

function RootLayoutContent() {
  const { activeTheme } = useTheme();
  const colors = useColors();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <StatusBar style={activeTheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <ThemeProvider>
          <RootLayoutContent />
        </ThemeProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
