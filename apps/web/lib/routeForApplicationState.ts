/**
 * Single source of post-login routing for the driver portal.
 *
 * Clerk authenticating a driver says nothing about whether they may drive —
 * `driver_applications.state` does. A driver mid-onboarding goes back into the
 * wizard; one awaiting or refused admin review goes to the dashboard, which
 * renders the pending / rejection tracker.
 */
export function routeForApplicationState(state: string | null | undefined): string {
  switch (state) {
    case 'agreement_signed':
      return '/onboarding/personal-docs'
    case 'personal_docs_submitted':
      return '/onboarding/vehicle-details'
    case 'vehicle_added':
      return '/onboarding/vehicle-docs'
    case 'vehicle_docs_submitted':
    case 'in_review':
    case 'rejected':
    case 'activated':
      return '/dashboard'
    // 'phone_entered' (fresh signup) and anything unrecognised start at the top
    // of the wizard.
    default:
      return '/onboarding/agreement'
  }
}
