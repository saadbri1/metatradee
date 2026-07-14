'use client';

/**
 * Contextual paywall — shown at the moment of demonstrated value, naming the
 * exact gated capability. Honest, non-dark-pattern: it explains what unlocks and
 * links to plans; it never blocks access the user already paid for. Accessible
 * (labelled region, keyboard CTA).
 */
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function Paywall({
  title,
  description,
}: {
  /** Names the exact unlocked value, e.g. "Unlock the AI Coach". */
  title: string;
  description: string;
}) {
  return (
    <Card role="region" aria-label={title} className="border-primary/40 bg-primary/5">
      <CardContent className="flex flex-col items-start gap-3 p-6">
        <div className="flex items-center gap-2">
          <Lock className="size-5 text-primary" aria-hidden />
          <h3 className="font-display text-lg font-semibold">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button asChild>
          <Link href="/billing">View plans</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
