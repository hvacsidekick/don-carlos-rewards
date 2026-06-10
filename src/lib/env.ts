import { z } from "zod";

/**
 * Zod-validated environment loader. Fails fast at module load with a clear,
 * aggregated error when a required variable is missing or malformed
 * (PLAN.md Phase 1 acceptance criteria; BLUEPRINT.md §10.1).
 *
 * Only `NEXT_PUBLIC_*` vars are exposed to the client bundle. The
 * service-role key is validated server-side ONLY and must never be imported
 * into a Client Component (BLUEPRINT.md §1, §12).
 *
 * NOTE: `process.env.NEXT_PUBLIC_*` access must use static property access so
 * Next.js can inline the values into the client bundle at build time.
 */

/** Client-safe vars — validated in every environment (server + browser). */
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL (e.g. https://xyz.supabase.co)",
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_APP_URL: z.string().url({
    message: "NEXT_PUBLIC_APP_URL must be a valid URL (e.g. http://localhost:3000)",
  }),
  // Optional in Phase 1 — wired up in their respective phases.
  NEXT_PUBLIC_MAPS_EMBED: z.string().optional(),
});

/** Server-only vars — never sent to the client. */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required (server-only)"),
  // Optional until their phases (rate limiting = Phase 10, Sentry = Phase 12).
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

function formatErrors(error: z.ZodError): string {
  return error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
}

/**
 * Statically referenced so Next.js can inline NEXT_PUBLIC_* at build time.
 * Do not refactor to dynamic key access.
 */
const clientEnvRaw = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_MAPS_EMBED: process.env.NEXT_PUBLIC_MAPS_EMBED,
};

const parsedClient = clientSchema.safeParse(clientEnvRaw);
if (!parsedClient.success) {
  throw new Error(
    `❌ Invalid client environment variables:\n${formatErrors(parsedClient.error)}\n` +
      `Copy .env.example to .env.local and fill in the required values.`,
  );
}

export const clientEnv = parsedClient.data;

/**
 * Server env is validated lazily and ONLY on the server. Accessing it from a
 * client bundle is a programming error and throws.
 */
let _serverEnv: z.infer<typeof serverSchema> | undefined;

export function getServerEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must not be called in client code.");
  }
  if (_serverEnv) return _serverEnv;

  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    SENTRY_DSN: process.env.SENTRY_DSN,
  });
  if (!parsed.success) {
    throw new Error(`❌ Invalid server environment variables:\n${formatErrors(parsed.error)}`);
  }
  _serverEnv = parsed.data;
  return _serverEnv;
}
