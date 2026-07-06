'use client';
import {
  Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Divider, Typography, Box, Collapse,
} from '@mui/material';
import {
  Dashboard, People, DirectionsCar, Map, Gavel, TrendingUp,
  Payments, BarChart, Security, History, SupportAgent,
  Campaign, Settings, ExpandLess, ExpandMore,
  AssignmentTurnedIn, Policy, Speed,
} from '@mui/icons-material';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useRbac } from '@/hooks/useRbac';

const DRAWER_WIDTH = 220;

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href?: string;
  permission?: string;
  children?: { label: string; href: string; permission?: string }[];
}

export function Sidebar() {
  const pathname = usePathname();
  const { can, isRole } = useRbac();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    drivers: true, trips: false,
  });

  const toggle = (key: string) =>
    setOpenGroups((p) => ({ ...p, [key]: !p[key] }));

  const nav: NavItem[] = [
    { label: 'Dashboard', icon: <Dashboard fontSize="small" />, href: '/dashboard' },
    {
      label: 'Drivers', icon: <DirectionsCar fontSize="small" />,
      children: [
        { label: 'All Drivers',   href: '/drivers' },
        { label: 'Documents',     href: '/drivers/documents' },
        { label: 'EVP Tracker',   href: '/drivers/evp' },
        { label: 'Appeals',       href: '/drivers/appeals' },
      ],
    },
    { label: 'Riders', icon: <People fontSize="small" />, href: '/riders' },
    {
      label: 'Trips', icon: <Map fontSize="small" />,
      children: [
        { label: 'Live Map',     href: '/trips/live' },
        { label: 'Trip History', href: '/trips' },
      ],
    },
    { label: 'Disputes', icon: <Gavel fontSize="small" />, href: '/disputes' },
    { label: 'Surge Control', icon: <Speed fontSize="small" />, href: '/surge', permission: 'manage_surge' },
    { label: 'Commissions', icon: <TrendingUp fontSize="small" />, href: '/commissions', permission: 'adjust_commission' },
    { label: 'Incentives', icon: <Campaign fontSize="small" />, href: '/incentives', permission: 'manage_incentives' },
    { label: 'Payouts', icon: <Payments fontSize="small" />, href: '/payouts', permission: 'view_finance' },
    { label: 'Reports', icon: <BarChart fontSize="small" />, href: '/reports', permission: 'view_reports' },
    { label: 'PDPA Tools', icon: <Policy fontSize="small" />, href: '/pdpa', permission: 'pdpa_tools' },
    { label: 'Audit Log', icon: <History fontSize="small" />, href: '/audit', permission: 'view_audit' },
    { label: 'Support', icon: <SupportAgent fontSize="small" />, href: '/support' },
    { label: 'Notifications', icon: <AssignmentTurnedIn fontSize="small" />, href: '/notifications', permission: 'send_notifications' },
    { label: 'Admin Users', icon: <Settings fontSize="small" />, href: '/settings/admins', permission: 'manage_admins' },
  ];

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : (pathname ?? '').startsWith(href);

  const groupKey = (label: string) => label.toLowerCase();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 28, height: 28, bgcolor: 'primary.main', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>T</Typography>
        </Box>
        <Typography variant="subtitle2" fontWeight={700}>Teeko Admin</Typography>
      </Box>
      <Divider />
      <List dense sx={{ px: 1, pt: 1, flexGrow: 1, overflowY: 'auto' }}>
        {nav.map((item) => {
          if (item.permission && !can(item.permission as never)) return null;

          if (item.children) {
            const key = groupKey(item.label);
            const open = openGroups[key] ?? false;
            const anyActive = item.children.some((c) => isActive(c.href));
            return (
              <Box key={item.label}>
                <ListItemButton onClick={() => toggle(key)} sx={{ borderRadius: 1, mb: 0.25 }} selected={anyActive && !open}>
                  <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13 }} />
                  {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                </ListItemButton>
                <Collapse in={open}>
                  <List dense disablePadding>
                    {item.children.map((child) => (
                      <ListItemButton
                        key={child.href}
                        component={Link}
                        href={child.href}
                        selected={isActive(child.href)}
                        sx={{ pl: 4.5, borderRadius: 1, mb: 0.25 }}
                      >
                        <ListItemText primary={child.label} primaryTypographyProps={{ fontSize: 12 }} />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              </Box>
            );
          }

          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href!}
              selected={isActive(item.href!)}
              sx={{ borderRadius: 1, mb: 0.25 }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13 }} />
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
}
