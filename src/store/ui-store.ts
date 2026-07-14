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
export type SidebarMode = 'pinned' | 'floating';

interface UIState {
  // Persisted shell preferences.
  sidebarCollapsed: boolean;
  sidebarMode: SidebarMode;
  density: Density;
  // Ephemeral shell state (never persisted).
  mobileDrawerOpen: boolean;
  commandPaletteOpen: boolean;

  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setSidebarMode: (mode: SidebarMode) => void;
  toggleSidebarMode: () => void;
  setDensity: (density: Density) => void;
  setMobileDrawerOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarMode: 'pinned',
      density: 'comfortable',
      mobileDrawerOpen: false,
      commandPaletteOpen: false,

      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarMode: (sidebarMode) => set({ sidebarMode }),
      toggleSidebarMode: () =>
        set((s) => ({
          sidebarMode: s.sidebarMode === 'pinned' ? 'floating' : 'pinned',
        })),
      setDensity: (density) => set({ density }),
      setMobileDrawerOpen: (mobileDrawerOpen) => set({ mobileDrawerOpen }),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
    }),
    {
      name: 'metatradee-ui',
      storage: createJSONStorage(() => localStorage),
      // Persist only stable preferences — not transient open/closed flags.
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        sidebarMode: s.sidebarMode,
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
