'use client';

import { useState } from 'react';
import { HeartHandshake, Target, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormSkeleton } from '@/features/workspace/components/states';
import {
  usePsychologyOverview,
  useCreateGoal,
  useSetGoalStatus,
  useDeleteGoal,
  useCreateHabit,
  useLogHabit,
  useDeleteHabit,
} from '../hooks';
import { JournalEntry } from './journal-entry';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PsychologyDashboard() {
  const overview = usePsychologyOverview();
  const createGoal = useCreateGoal();
  const setGoalStatus = useSetGoalStatus();
  const deleteGoal = useDeleteGoal();
  const createHabit = useCreateHabit();
  const logHabit = useLogHabit();
  const deleteHabit = useDeleteHabit();

  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [habitName, setHabitName] = useState('');

  if (overview.isLoading) return <FormSkeleton rows={8} />;
  const data = overview.data;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Goals &amp; Wellbeing</h1>

      {/* Wellbeing banner — supportive, de-escalating, never shaming. */}
      {data?.wellbeing ? (
        <Card className={data.wellbeing.distressed ? 'border-warning/40 bg-warning/10' : ''}>
          <CardContent className="flex items-start gap-3 p-4">
            <HeartHandshake className="size-5 shrink-0 text-primary" aria-hidden />
            <p className="text-sm" role="status">
              {data.wellbeing.message}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Discipline score (single-sourced composite). */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Discipline score</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="tabular text-3xl font-semibold">
            {data?.discipline.score ?? '—'}
            <span className="text-base text-muted-foreground"> / 100</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            A target to build on — reflects habits, goals, and steadiness. Not a judgment.
          </p>
        </CardContent>
      </Card>

      {/* Goals */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Goals</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const target = Number(goalTarget);
            if (!goalName || !Number.isFinite(target)) return;
            createGoal.mutate(
              {
                name: goalName,
                metric: 'win_rate',
                target_value: target,
                direction: 'gte',
                goal_type: 'custom',
                status: 'active',
              },
              {
                onSuccess: () => {
                  setGoalName('');
                  setGoalTarget('');
                },
              },
            );
          }}
        >
          <Input
            aria-label="Goal name"
            placeholder="e.g. Win rate ≥ 55%"
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
            className="max-w-xs"
          />
          <Input
            aria-label="Target value"
            type="number"
            step="any"
            placeholder="Target (win rate %)"
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
            className="max-w-[10rem]"
          />
          <Button type="submit" disabled={createGoal.isPending}>
            <Target aria-hidden /> Add goal
          </Button>
        </form>

        {data && data.goals.length > 0 ? (
          <ul className="space-y-2">
            {data.goals.map((g) => (
              <li key={g.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{g.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={g.achieved ? 'default' : 'secondary'}>
                      {g.progressPct === null ? '—' : `${g.progressPct}%`}
                    </Badge>
                    {g.status !== 'completed' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setGoalStatus.mutate({ id: g.id, status: 'completed' })}
                      >
                        Complete
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${g.name}`}
                      onClick={() => deleteGoal.mutate(g.id)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full bg-primary" style={{ width: `${g.progressPct ?? 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No goals yet — add one above.</p>
        )}
      </section>

      {/* Habits */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Habits</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!habitName) return;
            createHabit.mutate(
              {
                name: habitName,
                habit_type: 'custom',
                cadence: 'daily',
                target_per_week: 7,
                freeze_tokens: 2,
                is_active: true,
              },
              { onSuccess: () => setHabitName('') },
            );
          }}
        >
          <Input
            aria-label="Habit name"
            placeholder="e.g. Pre-market routine"
            value={habitName}
            onChange={(e) => setHabitName(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" disabled={createHabit.isPending}>
            Add habit
          </Button>
        </form>

        {data && data.habits.length > 0 ? (
          <ul className="space-y-2">
            {data.habits.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div>
                  <span className="font-medium">{h.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    🔥 {h.currentStreak} day streak · best {h.longestStreak}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      logHabit.mutate({
                        habit_id: h.id,
                        log_date: today(),
                        completed: true,
                        is_rest_day: false,
                      })
                    }
                  >
                    Done today
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Rest days are celebrated and never break your streak"
                    onClick={() =>
                      logHabit.mutate({
                        habit_id: h.id,
                        log_date: today(),
                        completed: false,
                        is_rest_day: true,
                      })
                    }
                  >
                    Rest day
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${h.name}`}
                    onClick={() => deleteHabit.mutate(h.id)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No habits yet — add one above.</p>
        )}
      </section>

      <JournalEntry />

      {/* Emotion ↔ performance (transparent correlation with sample sizes). */}
      {data && data.emotionCorrelation.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Performance by logged emotion
          </h2>
          <p className="text-xs text-muted-foreground">
            Correlation only (not causation), shown with sample sizes.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">Win rate by logged emotion</caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-3 py-2">
                    Emotion
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Trades
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Win rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.emotionCorrelation.map((r) => (
                  <tr key={r.emotion} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 text-left font-medium">
                      {r.emotion}
                    </th>
                    <td className="tabular px-3 py-2 text-right">{r.trades}</td>
                    <td className="tabular px-3 py-2 text-right">
                      {r.winRate === null ? '—' : `${(r.winRate * 100).toFixed(0)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
