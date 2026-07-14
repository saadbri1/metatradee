import { describe, it, expect } from 'vitest';
import {
  navigateCommands,
  registerCommandSource,
  getCommandSources,
} from '@/features/shell/command/registry';
import { ALL_NAV_ITEMS } from '@/features/shell/nav';

describe('navigateCommands', () => {
  it('produces one navigate command per nav item', () => {
    const cmds = navigateCommands();
    expect(cmds).toHaveLength(ALL_NAV_ITEMS.length);
    expect(cmds.every((c) => c.category === 'navigate')).toBe(true);
    expect(cmds.every((c) => typeof c.href === 'string')).toBe(true);
  });
});

describe('command source registration (extension seam)', () => {
  it('starts empty and accepts registered sources', () => {
    const before = getCommandSources().length;
    registerCommandSource({ category: 'search', getCommands: () => [] });
    expect(getCommandSources().length).toBe(before + 1);
    expect(getCommandSources().at(-1)?.category).toBe('search');
  });
});
