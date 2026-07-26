import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { listStrategies } from '@/features/playbook/server/queries';
import { StrategyBuilder } from '@/features/playbook/components/strategy-builder';

export const metadata: Metadata = { title: 'New playbook' };

export default async function NewStrategyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Existing names power the duplicate warning before the unique index rejects
  // the insert.
  const existing = user ? await listStrategies(supabase, user.id) : [];

  return (
    <div className="mx-auto max-w-[1100px] space-y-3">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 h-7 px-2 text-xs text-muted-foreground"
          asChild
        >
          <Link href="/playbook">
            <ArrowLeft className="size-3.5" aria-hidden /> All playbooks
          </Link>
        </Button>
        <h1 className="mt-1 font-display text-xl font-semibold tracking-tight">New playbook</h1>
        <p className="text-xs text-muted-foreground">
          Record the rules you actually trade. Performance is measured later from the trades you
          link to it.
        </p>
      </div>
      <StrategyBuilder mode="create" existingNames={existing.map((s) => s.name)} />
    </div>
  );
}
