import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Ephemeral + persisted UI shell state (single source of truth for the app
 * shell). Server state → TanStack Query; URL state → the URL.
 *
 * Persistence: sidebar/density preferences persist to localStorage now, behind
 * this store's interface. When 9.x adds `user_preferences.dashboard_preferences`
 * columns, swap the storage layer here without touching consumers (the DB seam).
 * `skipHydration` defers rehydration to a post-mount effect so SSR and the first
 * client render match (no hydration warning).
 */
export type Density = 'comfortable' | 'compact' | 'terminal';
interface UIState {
  // Persisted shell preferences.
  sidebarCollapsed: boolean;
  density: Density;
  // Ephemeral shell state (never persisted).
  mobileDrawerOpen: boolean;
  commandPaletteOpen: boolean;

  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setDensity: (density: Density) => void;
  setMobileDrawerOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: true,
      density: 'comfortable',
      mobileDrawerOpen: false,
      commandPaletteOpen: false,

      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setDensity: (density) => set({ density }),
      setMobileDrawerOpen: (mobileDrawerOpen) => set({ mobileDrawerOpen }),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
    }),
    {
      name: 'metatradee-ui',
      storage: createJSONStorage(() => localStorage),
      version: 4,
      migrate: (persistedState) => ({
        ...(persistedState as Partial<UIState>),
        // Version 4 returns the compact icon rail as the desktop baseline, so the
        // Dashboard grid gets the full reference width.
        sidebarCollapsed: true,
      }),
      // Persist only stable preferences — not transient open/closed flags.
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        density: s.density,
      }),
      skipHydration: true,
    },
  ),
);

/** Rehydrate the persisted store after mount (pairs with `skipHydration`). */
export function hydrateUIStore(): void {
  void useUIStore.persist.rehydrate();
}
