import type { Metadata } from 'next';
import { BillingPortal } from '@/features/billing/components/billing-portal';

export const metadata: Metadata = { title: 'Billing' };

export default function BillingPage() {
  return <BillingPortal />;
}
