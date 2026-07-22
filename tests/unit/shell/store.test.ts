import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/store/ui-store';

describe('ui-store shell state', () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarCollapsed: false,
      mobileDrawerOpen: false,
      commandPaletteOpen: false,
    });
  });

  it('toggles the desktop sidebar between the labeled navigation and the compact rail', () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });

  it('migrates existing shells onto the compact rail baseline', () => {
    // The reference Dashboard gives the grid its full width, so the rail is the
    // documented desktop default for both new and returning shells.
    const options = useUIStore.persist.getOptions();
    expect(options.version).toBe(4);
    expect(options.migrate?.({ sidebarCollapsed: false }, 3)).toMatchObject({
      sidebarCollapsed: true,
    });
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
