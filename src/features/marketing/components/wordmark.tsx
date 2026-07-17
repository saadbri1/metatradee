import { siteConfig } from '@/config/site';

/** The MetaTradee wordmark + mark. Token-driven; used in nav and footer. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ''}`}>
      <span className="flex items-end gap-0.5" aria-hidden>
        <span className="h-2.5 w-6 translate-x-0.5 rounded-sm bg-primary" />
        <span className="h-2.5 w-6 rounded-sm bg-foreground" />
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">{siteConfig.name}</span>
    </span>
  );
}
