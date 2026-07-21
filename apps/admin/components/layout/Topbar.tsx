'use client';
import { AppBar, Toolbar, Typography, IconButton, Avatar, Chip, Box, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import { LightMode, DarkMode, Logout, Menu as MenuIcon } from '@mui/icons-material';
import { useAdminAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/mock-accounts';
import { useRouter } from 'next/navigation';

export function Topbar() {
  const { profile, logout, themeMode, toggleTheme } = useAdminAuthStore();
  const router = useRouter();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const toggleDesktop = useUiStore((s) => s.toggleDesktop);
  const toggleMobile = useUiStore((s) => s.toggleMobile);
  const toggleSidebar = () => (isDesktop ? toggleDesktop() : toggleMobile());

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.primary',
      }}
    >
      <Toolbar variant="dense" sx={{ minHeight: 48, px: 2 }}>
        <Tooltip title="Toggle sidebar">
          <IconButton size="small" edge="start" onClick={toggleSidebar} sx={{ mr: 1 }}>
            <MenuIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Tooltip title={`Switch to ${themeMode === 'light' ? 'dark' : 'light'} mode`}>
            <IconButton size="small" onClick={toggleTheme}>
              {themeMode === 'light' ? <DarkMode fontSize="small" /> : <LightMode fontSize="small" />}
            </IconButton>
          </Tooltip>
          {profile && (
            <>
              <Chip
                label={ROLE_LABELS[profile.role]}
                color={ROLE_COLORS[profile.role]}
                size="small"
                sx={{ fontWeight: 600, fontSize: 11 }}
              />
              <Typography variant="body2" fontWeight={500}>{profile.name}</Typography>
              <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: 'primary.main' }}>
                {profile.avatar}
              </Avatar>
            </>
          )}
          <Tooltip title="Logout">
            <IconButton size="small" onClick={handleLogout}>
              <Logout fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
