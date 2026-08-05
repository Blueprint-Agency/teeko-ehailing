import * as Linking from 'expo-linking';

// Onboarding — PDPA consent, document upload, vehicle details — lives in the
// driver web portal only (see register-choice.tsx). The app never uploads
// documents; it links out and then re-reads driver_applications.state to decide
// where the driver belongs.
const PORTAL_BASE = process.env.EXPO_PUBLIC_DRIVER_PORTAL_URL ?? 'http://localhost:3001';

export type PortalPath =
  | '/auth/register'
  | '/onboarding'
  | '/onboarding/agreement'
  | '/onboarding/personal-docs'
  | '/onboarding/vehicle-details'
  | '/onboarding/vehicle-docs'
  | '/profile';

export function portalUrl(path: PortalPath): string {
  return PORTAL_BASE + path;
}

export async function openPortal(path: PortalPath): Promise<void> {
  await Linking.openURL(portalUrl(path));
}

/**
 * The portal page that continues an application from a given state. Clerk is
 * shared across both apps, so the driver lands signed in and resumes in place.
 */
export function portalPathForApplicationState(state: string | null | undefined): PortalPath {
  switch (state) {
    case 'agreement_signed':
      return '/onboarding/personal-docs';
    case 'personal_docs_submitted':
      return '/onboarding/vehicle-details';
    case 'vehicle_added':
      return '/onboarding/vehicle-docs';
    // Submitted / in review / rejected all resume at the wizard root, which
    // shows the review status and any resubmission the admin asked for.
    case 'vehicle_docs_submitted':
    case 'in_review':
    case 'rejected':
      return '/onboarding';
    default:
      return '/onboarding/agreement';
  }
}
