import type { Metadata } from 'next';
import { AICoachDashboard } from '@/features/ai-coach/components/ai-coach-dashboard';

export const metadata: Metadata = { title: 'AI Coach' };

export default function AICoachPage() {
  return <AICoachDashboard />;
}
