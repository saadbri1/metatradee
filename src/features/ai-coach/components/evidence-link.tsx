import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

/**
 * EvidenceLink — a labelled link from an insight to the actual trade it cites,
 * so every claim is traceable to real data. Screen-reader friendly.
 */
export function EvidenceLink({ tradeId, index }: { tradeId: string; index: number }) {
  const short = tradeId.slice(0, 8);
  return (
    <Link
      href={`/journal/${tradeId}`}
      className="inline-flex items-center gap-0.5 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      aria-label={`View referenced trade ${index + 1} (id ${short})`}
    >
      Trade {index + 1}
      <ArrowUpRight className="size-3" aria-hidden />
    </Link>
  );
}
