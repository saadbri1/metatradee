'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Highlights a real value change without inventing intermediate financial data. */
export function SemanticValue({
  value,
  children,
  className,
}: {
  value: number | null | undefined;
  children: ReactNode;
  className?: string;
}) {
  const previous = useRef(value);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = value;
    if (before === null || before === undefined || value === null || value === undefined) return;
    if (before === value) return;
    setDirection(value > before ? 'up' : 'down');
    const timeout = window.setTimeout(() => setDirection(null), 740);
    return () => window.clearTimeout(timeout);
  }, [value]);

  return (
    <span
      className={cn(
        'rounded-sm px-0.5 transition-colors',
        direction === 'up' && 'motion-value-up',
        direction === 'down' && 'motion-value-down',
        className,
      )}
      data-change={direction ?? undefined}
    >
      {children}
    </span>
  );
}
