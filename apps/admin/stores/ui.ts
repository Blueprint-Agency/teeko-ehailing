'use client';
import { create } from 'zustand';

interface UiState {
  /** Desktop (md+) sidebar expanded/collapsed. */
  desktopOpen: boolean;
  /** Mobile (< md) temporary drawer open/closed. */
  mobileOpen: boolean;
  toggleDesktop: () => void;
  toggleMobile: () => void;
  closeMobile: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  desktopOpen: true,
  mobileOpen: false,
  toggleDesktop: () => set((s) => ({ desktopOpen: !s.desktopOpen })),
  toggleMobile: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
  closeMobile: () => set({ mobileOpen: false }),
}));
