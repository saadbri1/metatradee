import type { Metadata } from 'next';
import { HelpCircle } from 'lucide-react';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';

export const metadata: Metadata = { title: 'Help' };

export default function HelpPage() {
  return (
    <PlaceholderPage
      title="Help"
      description="Guides, shortcuts, and support for MetaTradee."
      icon={HelpCircle}
    />
  );
}
