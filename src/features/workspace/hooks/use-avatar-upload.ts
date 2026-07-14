'use client';

import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import {
  validateAvatarFile,
  validateAvatarDimensions,
  avatarExtension,
  isAllowedAvatarMime,
} from '@/lib/db/avatar';
import { avatarPath } from '@/lib/db/paths';
import { finalizeAvatarAction } from '../server/actions';
import type { ActionResult } from '../types';

/** Read an image file's natural dimensions in the browser. */
function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image.'));
    };
    img.src = url;
  });
}

/**
 * Avatar upload: validate (type/size/dimensions) client-side, upload to the
 * user-scoped storage path, then finalize server-side (re-validate + record in
 * attachments + replace old). Returns the stored object path.
 */
export function useAvatarUpload() {
  return useMutation<ActionResult & { path?: string }, Error, File>({
    mutationFn: async (file) => {
      const basic = validateAvatarFile({ type: file.type, size: file.size });
      if (!basic.ok) return { ok: false, error: basic.error };
      if (!isAllowedAvatarMime(file.type)) {
        return { ok: false, error: 'Unsupported image type.' };
      }

      const { width, height } = await readDimensions(file);
      const dims = validateAvatarDimensions(width, height);
      if (!dims.ok) return { ok: false, error: dims.error };

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { ok: false, error: 'You must be signed in.' };

      const token =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : String(Date.now());
      const path = avatarPath(user.id, token, avatarExtension(file.type));

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) return { ok: false, error: 'Upload failed. Try again.' };

      const result = await finalizeAvatarAction({
        path,
        mime: file.type,
        size: file.size,
      });
      return result.ok ? { ok: true, path } : result;
    },
  });
}
