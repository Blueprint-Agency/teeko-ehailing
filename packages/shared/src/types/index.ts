// ─── Auth ────────────────────────────────────────────────────────────────────

export interface DriverProfile {
  id: string
  fullName: string
  phone: string
  email: string
  onboardingStep: number
  agreementAccepted: boolean
  agreementTimestamp?: string | null
}

// ─── Documents ───────────────────────────────────────────────────────────────

export type DocumentStatus = 'empty' | 'uploaded' | 'under_review' | 'approved' | 'rejected'

export interface DocumentState {
  id: string
  label: string
  status: DocumentStatus
  fileUrl?: string
  fileName?: string
  rejectionReason?: string
  uploadedAt?: string | null
  reviewedAt?: string | null
}

export type PersonalDocId =
  | 'nric_front'
  | 'nric_back'
  | 'cdl'
  | 'psv_d'
  | 'insurance'
  | 'selfie'

export type VehicleDocId =
  | 'car_grant'
  | 'road_tax'
  | 'vehicle_insurance'
  | 'puspakom'

// ─── Vehicle ─────────────────────────────────────────────────────────────────

export interface VehicleDetails {
  make: string
  model: string
  year: number
  plateNumber: string
  colour: string
}

// ─── Application Status ───────────────────────────────────────────────────────

export type ReviewStageStatus = 'pending' | 'in_progress' | 'approved' | 'rejected'
export type EVPStatus = 'not_started' | 'submitted' | 'approved' | 'rejected'
export type AccountStatus = 'pending_activation' | 'active' | 'suspended'

export interface ApplicationStatus {
  docReview: ReviewStageStatus
  evpApplication: EVPStatus
  evpBody?: 'APAD' | 'LPKP'
  evpSubmittedDate?: string | null
  accountStatus: AccountStatus
  activatedDate?: string | null
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string
  type: 'doc_approved' | 'doc_rejected' | 'evp_update' | 'account_activated'
  title: string
  body: string
  read: boolean
  createdAt: string
}

// ─── i18n ────────────────────────────────────────────────────────────────────

export type Locale = 'en' | 'ms' | 'zh' | 'ta'
