export type AdminRole = 'super_admin' | 'operations' | 'support' | 'finance';

export interface MockAccount {
  id: string;
  email: string;
  password: string;
  role: AdminRole;
  name: string;
  avatar: string;
}

export const MOCK_ACCOUNTS: MockAccount[] = [
  { id: 'a1', email: 'superadmin@teeko.my', password: 'demo1234', role: 'super_admin',  name: 'Amir Razif',    avatar: 'AR' },
  { id: 'a2', email: 'ops@teeko.my',        password: 'demo1234', role: 'operations',   name: 'Nurul Aina',    avatar: 'NA' },
  { id: 'a3', email: 'support@teeko.my',    password: 'demo1234', role: 'support',      name: 'Haziq Zulkifli', avatar: 'HZ' },
  { id: 'a4', email: 'finance@teeko.my',    password: 'demo1234', role: 'finance',      name: 'Priya Nair',    avatar: 'PN' },
];

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  operations:  'Operations',
  support:     'Support',
  finance:     'Finance',
};

export const ROLE_COLORS: Record<AdminRole, 'error' | 'secondary' | 'info' | 'success'> = {
  super_admin: 'error',
  operations:  'secondary',
  support:     'info',
  finance:     'success',
};
