'use client';
import { useAdminAuthStore } from '@/stores/auth';
import { PERMISSIONS, type Permission } from '@/lib/rbac-config';
import { useCallback } from 'react';

export function useRbac() {
  const role = useAdminAuthStore((s) => s.profile?.role);

  const can = useCallback((permission: Permission): boolean => {
    if (!role) return false;
    return PERMISSIONS[permission].includes(role);
  }, [role]);

  const isRole = useCallback((...roles: string[]) => !!role && roles.includes(role), [role]);

  return { can, isRole, role };
}
