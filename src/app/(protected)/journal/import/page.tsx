import type { Metadata } from 'next';
import { ImportWizard } from '@/features/import/components/import-wizard';

export const metadata: Metadata = { title: 'Import Trades' };

export default function ImportPage() {
  return <ImportWizard />;
}
