'use client';

/**
 * AI Coach dashboard. Scope tabs (daily / weekly / monthly) each drive a
 * ReviewPanel for the current period, plus a history timeline of past reviews.
 * Coach surfaces only — not a chatbot, no message box, unmetered to the user.
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ReviewPanel } from './review-panel';
import { useHistory } from '../hooks';
import type { ReviewScope } from '../types';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
/** Monday of the current week (UTC), matching the 9.9 week convention. */
function weekStartISO() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

const SCOPE_LABEL: Record<ReviewScope, string> = {
  trade: 'Trade',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export function AICoachDashboard() {
  const history = useHistory();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">AI Coach</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Evidence-linked coaching from your own trading data. Numbers come straight from your
          analytics — the coach interprets, it never invents figures or gives financial advice.
        </p>
      </div>

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="mt-4">
          <ReviewPanel scope="daily" targetId={todayISO()} title="Today's review" />
        </TabsContent>
        <TabsContent value="weekly" className="mt-4">
          <ReviewPanel scope="weekly" targetId={weekStartISO()} title="This week's review" />
        </TabsContent>
        <TabsContent value="monthly" className="mt-4">
          <ReviewPanel scope="monthly" targetId={monthKey()} title="This month's review" />
        </TabsContent>
      </Tabs>

      {/* History timeline. */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">Recent reviews</h2>
        {history.data && history.data.length > 0 ? (
          <ul className="space-y-2">
            {history.data.map((r) => (
              <li key={`${r.scope}-${r.targetId}`}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-2 p-3 text-sm">
                    <span>
                      <span className="font-medium">{SCOPE_LABEL[r.scope]}</span>
                      <span className="ml-2 text-muted-foreground">{r.targetId}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.generatedAt).toLocaleDateString()}
                      {r.mock ? ' · sample' : ''}
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No reviews yet — generate one above to start building your coaching history.
          </p>
        )}
      </section>
    </div>
  );
}
