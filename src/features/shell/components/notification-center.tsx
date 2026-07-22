'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Notifications have no data source yet. Keep the familiar header position,
 * but communicate that honestly instead of opening a decorative empty panel.
 */
export function NotificationCenter() {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Notifications unavailable"
            aria-disabled="true"
            className="cursor-not-allowed opacity-50 hover:bg-transparent hover:text-current"
            onClick={(event) => event.preventDefault()}
          >
            <Bell aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Notifications are not available yet.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
