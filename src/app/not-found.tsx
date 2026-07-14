import Link from 'next/link';
import { APP_ROUTES } from '@/constants';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="font-display text-3xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">This page doesn&apos;t exist.</p>
      <Link href={APP_ROUTES.home} className="text-primary underline">
        Go home
      </Link>
    </main>
  );
}
