'use client';

import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useUIStore } from '@/store/ui-store';
import { navigateCommands } from '../command/registry';

/**
 * ⌘K command palette. Accessible dialog (cmdk provides focus trap, arrow keys,
 * Esc, and restores focus). Only the Navigate category is functional this phase;
 * Search/Action sources are registered by later phases (see registry).
 */
export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const router = useRouter();
  const commands = navigateCommands();

  function go(href?: string) {
    if (!href) return;
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <DialogTitle className="sr-only">Command palette</DialogTitle>
      <DialogDescription className="sr-only">
        Search commands and navigate the app.
      </DialogDescription>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {commands.map((cmd) => (
            <CommandItem
              key={cmd.id}
              value={cmd.label}
              keywords={cmd.keywords}
              onSelect={() => go(cmd.href)}
            >
              {cmd.icon ? <cmd.icon aria-hidden /> : null}
              {cmd.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
