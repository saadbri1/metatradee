import type { Metadata } from 'next';
import { StrategyBuilder } from '@/features/playbook/components/strategy-builder';

export const metadata: Metadata = { title: 'New strategy' };

export default function NewStrategyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">New strategy</h1>
      <StrategyBuilder mode="create" />
    </div>
  );
}
