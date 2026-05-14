'use client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { buildTheme } from './theme';
import { useAdminAuthStore } from '@/stores/auth';
import { EmotionRegistry } from './emotion-registry';
import { useMemo, useEffect, useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const themeMode = useAdminAuthStore((s) => s.themeMode);
  const theme = useMemo(() => buildTheme(mounted ? themeMode : 'light'), [themeMode, mounted]);

  useEffect(() => { setMounted(true); }, []);

  return (
    <EmotionRegistry>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </EmotionRegistry>
  );
}
