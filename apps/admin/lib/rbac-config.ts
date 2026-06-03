import type { AdminRole } from './mock-accounts';

type Permission =
  | 'approve_driver'
  | 'reject_driver'
  | 'deactivate_driver'
  | 'suspend_driver'
  | 'reinstate_driver'
  | 'adjust_commission'
  | 'manage_incentives'
  | 'manage_surge'
  | 'process_payouts'
  | 'trigger_payout'
  | 'view_reports'
  | 'export_reports'
  | 'resolve_dispute'
  | 'approve_refund'
  | 'manage_support'
  | 'send_notifications'
  | 'pdpa_tools'
  | 'view_audit'
  | 'manage_admins'
  | 'ban_rider'
  | 'view_finance';

const PERMISSIONS: Record<Permission, AdminRole[]> = {
  approve_driver:     ['super_admin', 'operations'],
  reject_driver:      ['super_admin', 'operations'],
  deactivate_driver:  ['super_admin', 'operations'],
  suspend_driver:     ['super_admin', 'operations'],
  reinstate_driver:   ['super_admin', 'operations'],
  adjust_commission:  ['super_admin', 'finance'],
  manage_incentives:  ['super_admin', 'operations', 'finance'],
  manage_surge:       ['super_admin', 'operations'],
  process_payouts:    ['super_admin', 'finance'],
  trigger_payout:     ['super_admin', 'finance'],
  view_reports:       ['super_admin', 'finance', 'operations'],
  export_reports:     ['super_admin', 'finance'],
  resolve_dispute:    ['super_admin', 'operations', 'support'],
  approve_refund:     ['super_admin', 'operations', 'finance'],
  manage_support:     ['super_admin', 'support'],
  send_notifications: ['super_admin', 'operations'],
  pdpa_tools:         ['super_admin'],
  view_audit:         ['super_admin', 'finance'],
  manage_admins:      ['super_admin'],
  ban_rider:          ['super_admin', 'operations'],
  view_finance:       ['super_admin', 'finance'],
};

export type { Permission };
export { PERMISSIONS };
