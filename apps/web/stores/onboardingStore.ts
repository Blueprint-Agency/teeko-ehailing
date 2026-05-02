import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DocumentState, VehicleDetails } from '@teeko/shared/types'
import { api } from '@/lib/api'

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

  personalDocs: DocumentState[]
  vehicleDetails: VehicleDetails | null
  vehicleDocs: DocumentState[]

  setStep: (step: OnboardingStep) => void
  acceptAgreement: () => void
  updatePersonalDoc: (id: string, updates: Partial<DocumentState>) => void
  uploadPersonalDoc: (id: string, file: File, driverId: string) => Promise<void>
  setVehicleDetails: (details: VehicleDetails) => void
  updateVehicleDoc: (id: string, updates: Partial<DocumentState>) => void
  uploadVehicleDoc: (id: string, file: File, driverId: string) => Promise<void>
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
      personalDocs: initialPersonalDocs,
      vehicleDetails: null,
      vehicleDocs: initialVehicleDocs,

      setStep: (step) => set({ currentStep: step }),

      acceptAgreement: () =>
        set({ agreementAccepted: true, agreementTimestamp: new Date().toISOString() }),

      updatePersonalDoc: (id, updates) =>
        set((state) => ({
          personalDocs: state.personalDocs.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        })),

      uploadPersonalDoc: async (id, file, driverId) => {
        set((state) => ({
          personalDocs: state.personalDocs.map((d) =>
            d.id === id
              ? { ...d, status: 'uploaded' as const, fileName: file.name, fileUrl: URL.createObjectURL(file), uploadedAt: new Date().toISOString() }
              : d
          ),
        }))
        const { url } = await api.uploadDocument(id, file, driverId)
        set((state) => ({
          personalDocs: state.personalDocs.map((d) => (d.id === id ? { ...d, fileUrl: url } : d)),
        }))
      },

      setVehicleDetails: (details) => set({ vehicleDetails: details }),

      updateVehicleDoc: (id, updates) =>
        set((state) => ({
          vehicleDocs: state.vehicleDocs.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        })),

      uploadVehicleDoc: async (id, file, driverId) => {
        set((state) => ({
          vehicleDocs: state.vehicleDocs.map((d) =>
            d.id === id
              ? { ...d, status: 'uploaded' as const, fileName: file.name, fileUrl: URL.createObjectURL(file), uploadedAt: new Date().toISOString() }
              : d
          ),
        }))
        const { url } = await api.uploadDocument(id, file, driverId)
        set((state) => ({
          vehicleDocs: state.vehicleDocs.map((d) => (d.id === id ? { ...d, fileUrl: url } : d)),
        }))
      },

      reset: () =>
        set({
          currentStep: 0,
          agreementAccepted: false,
          agreementTimestamp: null,
          personalDocs: initialPersonalDocs,
          vehicleDetails: null,
          vehicleDocs: initialVehicleDocs,
        }),
    }),
    {
      name: 'teeko_onboarding_v2',
      partialize: (state) => ({
        agreementAccepted: state.agreementAccepted,
        agreementTimestamp: state.agreementTimestamp,
        vehicleDetails: state.vehicleDetails,
      }),
    }
  )
)
