import type { Metadata } from 'next';
import { PsychologyDashboard } from '@/features/psychology/components/psychology-dashboard';

export const metadata: Metadata = { title: 'Goals & Wellbeing' };

export default function GoalsPage() {
  return <PsychologyDashboard />;
}
