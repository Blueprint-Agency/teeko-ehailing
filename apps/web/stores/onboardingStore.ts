import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DocumentState, VehicleDetails } from '@teeko/shared/types'

// Steps: 0=agreement, 1=personal-docs, 2=vehicle-details, 3=vehicle-docs, 4=confirmation
type OnboardingStep = 0 | 1 | 2 | 3 | 4

const makeDoc = (id: string, label: string): DocumentState => ({
  id,
  label,
  status: 'empty',
})

interface OnboardingStore {
  currentStep: OnboardingStep
  agreementAccepted: boolean
  agreementTimestamp: string | null
  submitted: boolean

  personalDocs: DocumentState[]
  vehicleDetails: VehicleDetails | null
  vehicleDocs: DocumentState[]

  // Raw File objects held in memory only (not persisted — not serializable).
  // Keyed by frontend doc id. Lost on refresh; the typed fields above survive.
  personalFiles: Record<string, File>
  vehicleFiles: Record<string, File>

  setStep: (step: OnboardingStep) => void
  acceptAgreement: () => void
  updatePersonalDoc: (id: string, updates: Partial<DocumentState>) => void
  uploadPersonalDoc: (id: string, file: File) => void
  setVehicleDetails: (details: VehicleDetails) => void
  updateVehicleDoc: (id: string, updates: Partial<DocumentState>) => void
  uploadVehicleDoc: (id: string, file: File) => void
  markSubmitted: () => void
  reset: () => void
}

const initialPersonalDocs: DocumentState[] = [
  makeDoc('nric_front', 'NRIC / MyKad (Front)'),
  makeDoc('nric_back', 'NRIC / MyKad (Back)'),
  makeDoc('cdl', 'Competent Driving Licence (CDL)'),
  makeDoc('psv_d', 'PSV-D Licence (E-hailing Licence)'),
  makeDoc('insurance', 'E-hailing Insurance Cover Note'),
  makeDoc('selfie', 'Profile Photo / Liveness Selfie'),
]

const initialVehicleDocs: DocumentState[] = [
  makeDoc('car_grant', 'Car Grant / VOC'),
  makeDoc('road_tax', 'Road Tax'),
  makeDoc('vehicle_insurance', 'E-hailing Insurance Cover Note'),
  makeDoc('puspakom', 'PUSPAKOM Inspection Certificate'),
]

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      currentStep: 0,
      agreementAccepted: false,
      agreementTimestamp: null,
      submitted: false,
      personalDocs: initialPersonalDocs,
      vehicleDetails: null,
      vehicleDocs: initialVehicleDocs,
      personalFiles: {},
      vehicleFiles: {},

      setStep: (step) => set({ currentStep: step }),

      acceptAgreement: () =>
        set({ agreementAccepted: true, agreementTimestamp: new Date().toISOString() }),

      updatePersonalDoc: (id, updates) =>
        set((state) => ({
          personalDocs: state.personalDocs.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        })),

      // Local-only: keep the File in memory and mark the slot uploaded. No
      // network call — everything is sent at the final submit step.
      uploadPersonalDoc: (id, file) =>
        set((state) => ({
          personalFiles: { ...state.personalFiles, [id]: file },
          personalDocs: state.personalDocs.map((d) =>
            d.id === id
              ? { ...d, status: 'uploaded' as const, fileName: file.name, fileUrl: URL.createObjectURL(file), uploadedAt: new Date().toISOString() }
              : d
          ),
        })),

      setVehicleDetails: (details) => set({ vehicleDetails: details }),

      updateVehicleDoc: (id, updates) =>
        set((state) => ({
          vehicleDocs: state.vehicleDocs.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        })),

      uploadVehicleDoc: (id, file) =>
        set((state) => ({
          vehicleFiles: { ...state.vehicleFiles, [id]: file },
          vehicleDocs: state.vehicleDocs.map((d) =>
            d.id === id
              ? { ...d, status: 'uploaded' as const, fileName: file.name, fileUrl: URL.createObjectURL(file), uploadedAt: new Date().toISOString() }
              : d
          ),
        })),

      markSubmitted: () => set({ submitted: true }),

      reset: () =>
        set({
          currentStep: 0,
          agreementAccepted: false,
          agreementTimestamp: null,
          submitted: false,
          personalDocs: initialPersonalDocs,
          vehicleDetails: null,
          vehicleDocs: initialVehicleDocs,
          personalFiles: {},
          vehicleFiles: {},
        }),
    }),
    {
      name: 'teeko_onboarding_v2',
      partialize: (state) => ({
        agreementAccepted: state.agreementAccepted,
        agreementTimestamp: state.agreementTimestamp,
        vehicleDetails: state.vehicleDetails,
        submitted: state.submitted,
      }),
    }
  )
)
