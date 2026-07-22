import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/store/ui-store';

describe('ui-store shell state', () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarCollapsed: true,
      mobileDrawerOpen: false,
      commandPaletteOpen: false,
    });
  });

  it('defaults the desktop sidebar to the compact rail and toggles it', () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it('includes the user-selected rail state in persisted shell preferences', () => {
    useUIStore.getState().setSidebarCollapsed(false);
    const options = useUIStore.persist.getOptions();
    const persisted = options.partialize?.(useUIStore.getState());
    expect(persisted).toMatchObject({ sidebarCollapsed: false });
    expect(persisted).not.toHaveProperty('mobileDrawerOpen');
  });

  it('controls command palette and mobile drawer', () => {
    useUIStore.getState().toggleCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    useUIStore.getState().setMobileDrawerOpen(true);
    expect(useUIStore.getState().mobileDrawerOpen).toBe(true);
  });
});
