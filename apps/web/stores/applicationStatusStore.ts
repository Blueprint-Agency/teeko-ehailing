import { create } from 'zustand'
import type { ApplicationStatus, DocumentState, Notification } from '@teeko/shared/types'
import mockStatus from '@/data/mock-application-status.json'
import mockDocs from '@/data/mock-documents.json'
import mockNotifs from '@/data/mock-notifications.json'

interface ApplicationStatusStore {
  status: ApplicationStatus
  personalDocs: DocumentState[]
  vehicleDocs: DocumentState[]
  notifications: Notification[]
  unreadCount: number

  markNotificationRead: (id: string) => void
  markAllRead: () => void
  resubmitDoc: (docId: string, file: File) => void
}

export const useApplicationStatusStore = create<ApplicationStatusStore>()((set) => ({
  status: mockStatus as ApplicationStatus,
  personalDocs: mockDocs.personal as DocumentState[],
  vehicleDocs: mockDocs.vehicle as DocumentState[],
  notifications: mockNotifs as Notification[],
  unreadCount: mockNotifs.filter((n) => !n.read).length,

  markNotificationRead: (id) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length }
    }),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  resubmitDoc: (docId, file) =>
    set((state) => {
      const updateDoc = (docs: DocumentState[]) =>
        docs.map((d) =>
          d.id === docId
            ? {
                ...d,
                status: 'uploaded' as const,
                fileName: file.name,
                fileUrl: URL.createObjectURL(file),
                rejectionReason: undefined,
                uploadedAt: new Date().toISOString(),
              }
            : d
        )
      return {
        personalDocs: updateDoc(state.personalDocs),
        vehicleDocs: updateDoc(state.vehicleDocs),
      }
    }),
}))
