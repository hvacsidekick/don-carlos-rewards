import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest config (PLAN.md §Phase 10 P10-CF-2 — stand up a test harness).
 *
 * Scope: PURE, server-side security/utility functions (no DOM, no Next runtime).
 * The `@/*` alias mirrors tsconfig so test imports match app imports. `node`
 * environment — none of the covered units touch the DOM. Tests live in
 * `tests/unit/**` (kept out of the `src` build graph).
 *
 * `setupFiles` seeds the NEXT_PUBLIC_* env so `@/lib/env` (which fails fast at
 * module load) is satisfied when a unit transitively imports it (e.g.
 * `safeNextPath` lives in `site-url.ts` → `env.ts`). The values are dummy — no
 * unit under test makes a network call.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    globals: false,
  },
});
