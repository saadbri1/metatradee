import type { Metadata } from 'next';
import { ReportsCenter } from '@/features/reports/components/reports-center';

export const metadata: Metadata = { title: 'Reports' };

export default function ReportsPage() {
  return <ReportsCenter />;
}
