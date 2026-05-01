import { create } from 'zustand'
import type { ApplicationStatus, DocumentState, Notification } from '@teeko/shared/types'
import { api } from '@/lib/api'

interface ApplicationStatusStore {
  status: ApplicationStatus | null
  personalDocs: DocumentState[]
  vehicleDocs: DocumentState[]
  notifications: Notification[]
  unreadCount: number
  loading: boolean

  fetchAll: (driverId: string) => Promise<void>
  markNotificationRead: (id: string, driverId: string) => void
  markAllRead: (driverId: string) => void
  resubmitDoc: (docId: string, file: File, driverId: string) => void
}

export const useApplicationStatusStore = create<ApplicationStatusStore>()((set, get) => ({
  status: null,
  personalDocs: [],
  vehicleDocs: [],
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchAll: async (driverId) => {
    set({ loading: true })
    try {
      const [status, docs, notifs] = await Promise.all([
        api.getStatus(driverId),
        api.getDocuments(driverId),
        api.getNotifications(driverId),
      ])
      set({
        status,
        personalDocs: docs.personal,
        vehicleDocs: docs.vehicle,
        notifications: notifs,
        unreadCount: notifs.filter((n) => !n.read).length,
      })
    } finally {
      set({ loading: false })
    }
  },

  markNotificationRead: (id, driverId) => {
    api.markNotificationRead(driverId, id).catch(console.error)
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      )
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length }
    })
  },

  markAllRead: (driverId) => {
    api.markAllNotificationsRead(driverId).catch(console.error)
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }))
  },

  resubmitDoc: (docId, file, driverId) => {
    // Optimistic update
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
    })

    // Persist to backend
    const formData = new FormData()
    formData.append('file', file)
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/api/v1/driver-web/documents/${docId}/resubmit`, {
      method: 'POST',
      headers: { 'X-Teeko-User': driverId, 'X-Teeko-Role': 'driver' },
      body: formData,
    }).catch(console.error)

    // Refresh from server after a short delay
    setTimeout(() => get().fetchAll(driverId), 500)
  },
}))
