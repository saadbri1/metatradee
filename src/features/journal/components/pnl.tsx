import { cn } from '@/lib/utils';

/**
 * Money/PnL display. Uses the RESERVED --profit / --loss tokens (P&L only) and
 * tabular numerals. Provides accessible text (sign spelled for screen readers).
 */
export function Money({
  value,
  currency = 'USD',
  colored = false,
  className,
}: {
  value: number | null;
  currency?: string;
  colored?: boolean;
  className?: string;
}) {
  if (value === null || value === undefined) {
    return <span className={cn('tabular text-muted-foreground', className)}>—</span>;
  }
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
  }).format(value);

  const tone = colored && value > 0 ? 'text-profit' : colored && value < 0 ? 'text-loss' : '';
  const srSign = value > 0 ? 'profit ' : value < 0 ? 'loss ' : '';

  return (
    <span className={cn('tabular font-medium', tone, className)}>
      <span className="sr-only">{srSign}</span>
      {formatted}
    </span>
  );
}

export function Rr({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="tabular text-muted-foreground">—</span>;
  }
  return <span className="tabular">{value.toFixed(2)}R</span>;
}
