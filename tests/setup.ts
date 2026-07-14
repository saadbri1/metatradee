import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Provide the required public env so importing the validated `@/config/env`
// module (used transitively by auth code under test) does not throw. These are
// test-only placeholders, never real credentials.
process.env.NEXT_PUBLIC_APP_URL ||= 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';

afterEach(() => {
  cleanup();
});
