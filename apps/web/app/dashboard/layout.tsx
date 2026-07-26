import { RequireAuth } from '@/components/RequireAuth'

// Covers /dashboard and its nested routes (e.g. /dashboard/resubmit/[docId]).
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>
}
