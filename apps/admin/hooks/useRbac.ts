'use client';
import { useAdminAuthStore } from '@/stores/auth';
import { PERMISSIONS, type Permission } from '@/lib/rbac-config';

export function useRbac() {
  const role = useAdminAuthStore((s) => s.profile?.role);

  const can = (permission: Permission): boolean => {
    if (!role) return false;
    return PERMISSIONS[permission].includes(role);
  };

  const isRole = (...roles: string[]) => !!role && roles.includes(role);

  return { can, isRole, role };
}
