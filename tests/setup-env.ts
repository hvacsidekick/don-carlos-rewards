/**
 * Test env seed. `@/lib/env` validates NEXT_PUBLIC_* at module load and throws
 * if any are missing — so we provide harmless dummy values here. No unit under
 * test makes a network request; these only satisfy the fail-fast loader.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
