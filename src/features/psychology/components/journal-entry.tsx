'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/features/auth/components/submit-button';
import { FormAlert } from '@/features/auth/components/form-alert';
import { useAddPsychologyEntry } from '../hooks';

const SLIDERS = [
  { key: 'confidence', label: 'Confidence' },
  { key: 'stress', label: 'Stress' },
  { key: 'focus', label: 'Focus' },
  { key: 'discipline', label: 'Discipline' },
] as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fast affect-grid quick entry (private). Native range inputs are keyboard-
 * operable and screen-reader friendly. Reflective, not ruminative — one calm
 * capture, no negative amplification.
 */
export function JournalEntry() {
  const add = useAddPsychologyEntry();
  const [emotion, setEmotion] = useState('');
  const [notes, setNotes] = useState('');
  const [ratings, setRatings] = useState<Record<string, number>>({
    confidence: 50,
    stress: 50,
    focus: 50,
    discipline: 50,
  });
  const [saved, setSaved] = useState(false);

  function submit() {
    setSaved(false);
    add.mutate(
      {
        phase: 'general',
        emotion: emotion || null,
        confidence: ratings.confidence,
        stress: ratings.stress,
        focus: ratings.focus,
        discipline: ratings.discipline,
        notes: notes || null,
        entry_date: today(),
      },
      {
        onSuccess: (r) => {
          if (r.ok) {
            setSaved(true);
            setEmotion('');
            setNotes('');
          }
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">How are you feeling?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {saved ? <FormAlert tone="success">Logged. Thanks for checking in.</FormAlert> : null}
        <div className="space-y-1">
          <Label htmlFor="emotion">Emotion</Label>
          <Input
            id="emotion"
            value={emotion}
            onChange={(e) => setEmotion(e.target.value)}
            placeholder="calm, focused, anxious…"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {SLIDERS.map((s) => (
            <div key={s.key} className="space-y-1">
              <Label htmlFor={s.key} className="flex justify-between">
                <span>{s.label}</span>
                <span className="tabular text-muted-foreground">{ratings[s.key]}</span>
              </Label>
              <input
                id={s.key}
                type="range"
                min={0}
                max={100}
                value={ratings[s.key]}
                onChange={(e) => setRatings((r) => ({ ...r, [s.key]: Number(e.target.value) }))}
                className="w-full"
                style={{ accentColor: 'hsl(var(--primary))' }}
                aria-valuetext={`${ratings[s.key]} of 100`}
              />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <Label htmlFor="psych-notes">Notes (private)</Label>
          <Textarea
            id="psych-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <SubmitButton loading={add.isPending} loadingText="Saving…" onClick={submit} type="button">
          Log check-in
        </SubmitButton>
      </CardContent>
    </Card>
  );
}
