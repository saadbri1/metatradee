import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface AuthShellProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Consistent card wrapper for every auth screen. Semantic heading via CardTitle
 * (renders an <h3>-level via role); the (auth) layout provides the landmark.
 */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="font-display text-2xl tracking-tight">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer ? (
        <CardFooter className="justify-center text-sm text-muted-foreground">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}
