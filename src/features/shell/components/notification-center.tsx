'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Notification center PLACEHOLDER — bell + empty panel. No notification logic
 * this phase; a future phase feeds the panel. Structure/a11y are ready.
 */
export function NotificationCenter() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <div className="flex flex-col items-center gap-1 py-8 text-center">
            <Bell className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
