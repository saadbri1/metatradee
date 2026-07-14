'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Loader2, X } from 'lucide-react';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SubmitButton } from '@/features/auth/components/submit-button';
import { FormAlert } from '@/features/auth/components/form-alert';
import { profileSchema, type ProfileInput } from '../schemas';
import { COUNTRIES, LANGUAGES, getTimezones, type Option } from '../config';
import { useUpdateProfile, useUsernameCheck } from '../hooks/use-workspace-mutations';
import { SelectField } from './fields';
import { AvatarUploader } from './avatar-uploader';

const TIMEZONE_OPTIONS: Option[] = getTimezones().map((tz) => ({
  value: tz,
  label: tz,
}));

export function ProfileForm({
  defaultValues,
  avatarUrl,
  submitLabel = 'Save profile',
  onSaved,
}: {
  defaultValues?: Partial<ProfileInput>;
  avatarUrl?: string | null;
  submitLabel?: string;
  onSaved?: () => void;
}) {
  const update = useUpdateProfile();
  const usernameCheck = useUsernameCheck();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: '',
      username: '',
      bio: '',
      country: '',
      timezone: '',
      preferred_language: '',
      ...defaultValues,
    },
  });

  const username = form.watch('username');
  useEffect(() => {
    if (!username || username.length < 3) return;
    const id = setTimeout(() => usernameCheck.mutate(username), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  function onSubmit(values: ProfileInput) {
    setFormError(null);
    setSaved(false);
    update.mutate(values, {
      onSuccess: (result) => {
        if (result.ok) {
          setSaved(true);
          onSaved?.();
          return;
        }
        if (result.fieldErrors) {
          for (const [name, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0]) {
              form.setError(name as keyof ProfileInput, { message: messages[0] });
            }
          }
        }
        setFormError(result.error);
      },
      onError: () => setFormError('Something went wrong. Please try again.'),
    });
  }

  const availability = usernameCheck.data;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
        {saved ? <FormAlert tone="success">Profile saved.</FormAlert> : null}

        <AvatarUploader initialUrl={avatarUrl} displayName={form.getValues('display_name')} />

        <FormField
          control={form.control}
          name="display_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display name</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input autoComplete="off" spellCheck={false} {...field} />
                  <span className="absolute inset-y-0 right-2 flex items-center">
                    {usernameCheck.isPending ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
                    ) : availability?.available ? (
                      <Check className="size-4 text-primary" aria-hidden />
                    ) : availability && !availability.available ? (
                      <X className="size-4 text-destructive" aria-hidden />
                    ) : null}
                  </span>
                </div>
              </FormControl>
              <FormDescription aria-live="polite">
                {availability && !availability.available
                  ? availability.reason === 'reserved'
                    ? 'That username is reserved.'
                    : availability.reason === 'taken'
                      ? 'That username is taken.'
                      : 'Invalid username.'
                  : 'Letters, numbers, and underscores.'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bio</FormLabel>
              <FormControl>
                <Textarea rows={3} maxLength={500} {...field} />
              </FormControl>
              <FormDescription>A short line about how you trade (optional).</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField control={form.control} name="country" label="Country" options={COUNTRIES} />
          <SelectField
            control={form.control}
            name="preferred_language"
            label="Language"
            options={LANGUAGES}
          />
        </div>

        <SelectField
          control={form.control}
          name="timezone"
          label="Timezone"
          options={TIMEZONE_OPTIONS}
        />

        <SubmitButton loading={update.isPending} loadingText="Saving…">
          {submitLabel}
        </SubmitButton>
      </form>
    </Form>
  );
}
