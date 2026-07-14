'use client';

/**
 * Two-factor (TOTP) settings. Enroll → show the otpauth secret once → verify a
 * 6-digit code → factor is active. Self-serve unenroll. Secrets are managed by
 * Supabase; nothing sensitive is stored by the app. Accessible + keyboard-driven.
 */
import { useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormAlert } from '@/features/auth/components/form-alert';
import { useMfaState, useEnrollMfa, useVerifyMfa } from '../hooks';

export function MfaSettings() {
  const state = useMfaState();
  const enroll = useEnrollMfa();
  const verify = useVerifyMfa();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const enrolled = state.data?.enrolled === true;

  function startEnroll() {
    enroll.mutate(undefined, {
      onSuccess: (r) => {
        if (r.ok && r.data) {
          setFactorId(r.data.factorId);
          setSecret(r.data.secret);
        }
      },
    });
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    verify.mutate(
      { factorId, code },
      {
        onSuccess: (r) => {
          if (r.ok) {
            setFactorId(null);
            setSecret(null);
            setCode('');
          }
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          {enrolled ? (
            <ShieldCheck className="size-4 text-primary" aria-hidden />
          ) : (
            <ShieldAlert className="size-4 text-muted-foreground" aria-hidden />
          )}
          Two-factor authentication
        </CardTitle>
        <Badge variant={enrolled ? 'default' : 'outline'}>{enrolled ? 'On' : 'Off'}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Add a time-based one-time code (TOTP) from an authenticator app for stronger account
          security.
          {state.data?.required ? ' Your organization requires 2FA.' : ''}
        </p>

        {!enrolled && !factorId ? (
          <Button onClick={startEnroll} disabled={enroll.isPending}>
            Set up two-factor
          </Button>
        ) : null}

        {factorId && secret ? (
          <form className="space-y-3" onSubmit={submitCode}>
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Add this secret to your authenticator app, then enter the 6-digit code:
              </p>
              <p className="mt-1 select-all break-all font-mono text-sm">{secret}</p>
            </div>
            <Input
              aria-label="6-digit code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="max-w-[10rem]"
            />
            {verify.data && !verify.data.ok ? (
              <FormAlert tone="error">{verify.data.error}</FormAlert>
            ) : null}
            <Button type="submit" disabled={verify.isPending || code.length !== 6}>
              Verify &amp; enable
            </Button>
          </form>
        ) : null}

        {enroll.data && !enroll.data.ok ? (
          <FormAlert tone="error">{enroll.data.error}</FormAlert>
        ) : null}
      </CardContent>
    </Card>
  );
}
