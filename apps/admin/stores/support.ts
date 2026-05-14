'use client';
import { create } from 'zustand';
import ticketsData from '@/data/mock-support-tickets.json';

export interface SupportTicket {
  id: string; subject: string; raisedBy: string; userId: string;
  status: string; priority: string; category: string; date: string;
  assignedTo: string | null; messages: number;
}

interface SupportState {
  tickets: SupportTicket[];
  selectedTicketId: string | null;
  selectTicket: (id: string | null) => void;
  updateTicketStatus: (id: string, status: string) => void;
}

export const useSupportStore = create<SupportState>()((set) => ({
  tickets: ticketsData as SupportTicket[],
  selectedTicketId: null,
  selectTicket: (id) => set({ selectedTicketId: id }),
  updateTicketStatus: (id, status) =>
    set((s) => ({
      tickets: s.tickets.map((t) => (t.id === id ? { ...t, status } : t)),
    })),
}));
