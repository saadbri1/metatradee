import { siteConfig } from '@/config/site';

/**
 * Foundation placeholder only. Real marketing/product pages are built in
 * their own feature sprints. This confirms the app shell + tokens render.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <div aria-hidden className="flex items-end gap-1" title={`${siteConfig.name} mark`}>
        <span className="h-2 w-10 translate-x-1 rounded-sm bg-primary" />
        <span className="h-2 w-10 rounded-sm bg-foreground" />
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight">{siteConfig.name}</h1>
      <p className="text-muted-foreground">{siteConfig.tagline}</p>
      <p className="tabular font-mono text-sm text-muted-foreground">Foundation ready · v0.1.0</p>
    </main>
  );
}
