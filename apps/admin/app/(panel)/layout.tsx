'use client';
import { Box, Toolbar } from '@mui/material';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { useAdminAuthStore } from '@/stores/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAdminAuthStore((s) => s.hasHydrated);
  const logout = useAdminAuthStore((s) => s.logout);
  const router = useRouter();

  useEffect(() => {
    // Wait for the persisted store to rehydrate before judging auth, or we'd
    // bounce a valid session on first paint (initial state is unauthenticated).
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      // The middleware gate trusts the cookie; the store is empty here, so the
      // two have diverged. Clear the cookie as we leave, otherwise middleware
      // redirects /login → /dashboard and we loop back to this blank screen.
      logout();
      router.replace('/login');
    }
  }, [hasHydrated, isAuthenticated, logout, router]);

  // Render nothing until we know the answer (pre-hydration) or while leaving.
  if (!hasHydrated || !isAuthenticated) return null;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Topbar />
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          bgcolor: 'background.default',
          p: { xs: 2, md: 3 },
        }}
      >
        <Toolbar variant="dense" sx={{ minHeight: 48 }} />
        {children}
      </Box>
    </Box>
  );
}
