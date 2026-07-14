'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { AVATAR_ALLOWED_MIME } from '@/lib/db/avatar';
import { useAvatarUpload } from '../hooks/use-avatar-upload';

/**
 * Avatar picker + uploader. Validates client-side (type/size/dimensions in the
 * hook), uploads to the user-scoped path, and finalizes server-side. Shows a
 * local preview immediately; errors are announced via an alert region.
 */
export function AvatarUploader({
  initialUrl,
  displayName,
}: {
  initialUrl?: string | null;
  displayName?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useAvatarUpload();
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [error, setError] = useState<string | null>(null);

  const initials = (displayName ?? '?').slice(0, 2).toUpperCase();

  function onSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setError(null);
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    upload.mutate(file, {
      onSuccess: (result) => {
        if (!result.ok) {
          setError(result.error);
          setPreview(initialUrl ?? null);
        }
      },
      onError: () => {
        setError('Upload failed. Please try again.');
        setPreview(initialUrl ?? null);
      },
    });
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {preview ? <AvatarImage src={preview} alt="" /> : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
        >
          {upload.isPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Upload aria-hidden />
          )}
          {upload.isPending ? 'Uploading…' : 'Change avatar'}
        </Button>
        <p className="text-xs text-muted-foreground">PNG, JPEG, WEBP or GIF, up to 5 MB.</p>
        {error ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_ALLOWED_MIME.join(',')}
          className="sr-only"
          aria-label="Upload avatar"
          onChange={onSelect}
        />
      </div>
    </div>
  );
}
