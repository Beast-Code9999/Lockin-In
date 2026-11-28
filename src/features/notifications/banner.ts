/**
 * In-app banner for notifications that arrive while the app is open
 * (Android only shows FCM notifications by itself when the app is in the background).
 */
import { create } from 'zustand';

import type { AppLink } from './links';

export type Banner = { id: number; title: string; body: string; link: AppLink };

type BannerState = {
  banner: Banner | null;
  show: (b: Omit<Banner, 'id'>) => void;
  dismiss: (id: number) => void;
};

let nextId = 1;

export const useBanner = create<BannerState>((set) => ({
  banner: null,
  show: (b) => set({ banner: { ...b, id: nextId++ } }),
  dismiss: (id) => set((s) => (s.banner?.id === id ? { banner: null } : s)),
}));
