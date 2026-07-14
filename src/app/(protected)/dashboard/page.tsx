import type { Metadata } from 'next';
import { LayoutDashboard } from 'lucide-react';
import { PlaceholderPage } from '@/features/shell/components/placeholder-page';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <PlaceholderPage
      title="Dashboard"
      description="Your trading command center — key numbers and shortcuts will live here."
      icon={LayoutDashboard}
    />
  );
}
