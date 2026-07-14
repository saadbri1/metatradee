import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/store/ui-store';

describe('ui-store shell state', () => {
  beforeEach(() => {
    useUIStore.setState({
      sidebarCollapsed: false,
      sidebarMode: 'pinned',
      mobileDrawerOpen: false,
      commandPaletteOpen: false,
    });
  });

  it('toggles the sidebar collapsed state', () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });

  it('switches sidebar mode between pinned and floating', () => {
    useUIStore.getState().toggleSidebarMode();
    expect(useUIStore.getState().sidebarMode).toBe('floating');
    useUIStore.getState().setSidebarMode('pinned');
    expect(useUIStore.getState().sidebarMode).toBe('pinned');
  });

  it('controls command palette and mobile drawer', () => {
    useUIStore.getState().toggleCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    useUIStore.getState().setMobileDrawerOpen(true);
    expect(useUIStore.getState().mobileDrawerOpen).toBe(true);
  });
});
