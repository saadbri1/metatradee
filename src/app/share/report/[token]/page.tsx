import type { Metadata } from 'next';
import { getSharedReportAction } from '@/features/reports/server/actions';
import { SharedReportView } from '@/features/reports/components/shared-report-view';

export const metadata: Metadata = { title: 'Shared Report', robots: { index: false } };

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const initial = await getSharedReportAction(token);
  return (
    <main className="container mx-auto px-4">
      <SharedReportView token={token} initial={initial} />
    </main>
  );
}
