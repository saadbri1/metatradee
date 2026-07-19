import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';

interface AuthShellProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Consistent card wrapper for every auth screen; the (auth) layout provides the
 * landmark.
 *
 * The title is a REAL <h1>. It previously used `CardTitle`, whose doc comment
 * claimed it carried an <h3>-level role — it does not: `CardTitle` renders a
 * plain <div> (components/ui/card.tsx), so these screens exposed no heading at
 * all. That broke assistive-technology navigation (WCAG 1.3.1 / 2.4.6) and was
 * the genuine cause of the failing `getByRole('heading')` E2E assertions — the
 * tests were right and the component was wrong. Each auth screen is its own
 * page with a single primary heading, so <h1> is the correct level. `CardTitle`
 * is deliberately NOT changed globally, which would alter every other surface.
 * Visual classes are preserved exactly.
 */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <h1 className="font-display text-2xl font-semibold leading-none tracking-tight">{title}</h1>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer ? (
        <CardFooter className="justify-center text-sm text-muted-foreground">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}
