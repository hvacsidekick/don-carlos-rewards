import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";

/**
 * PWA manifest contract (PLAN.md §Phase 11 criterion 1).
 *
 * `manifest()` is a pure function, so we can assert its shape without a DOM or
 * the Next runtime — it stays inside the node-only harness. This locks the
 * installability-critical fields so a regression (missing maskable icon, wrong
 * display mode, etc.) fails the gate rather than only showing up in Lighthouse.
 */
describe("web app manifest", () => {
  const m = manifest();

  it("declares the installable identity fields", () => {
    expect(m.name).toBe("Don Carlos Rewards");
    expect(m.short_name).toBeTruthy();
    expect(m.short_name!.length).toBeLessThanOrEqual(12); // home-screen label fits
    expect(m.description).toBeTruthy();
  });

  it("is a standalone PWA rooted at the dashboard", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/dashboard");
    expect(m.scope).toBe("/");
  });

  it("sets brand theme + splash colors", () => {
    expect(m.theme_color).toBe("#E63946"); // --dc-red
    expect(m.background_color).toBe("#FFFFFF");
  });

  it("ships 192 + 512 'any' icons", () => {
    const any = (m.icons ?? []).filter((i) => i.purpose === "any");
    const sizes = any.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("ships at least one maskable icon (no adaptive-icon clipping)", () => {
    const maskable = (m.icons ?? []).filter((i) => i.purpose === "maskable");
    expect(maskable.length).toBeGreaterThanOrEqual(1);
    expect(maskable.some((i) => i.sizes === "512x512")).toBe(true);
  });

  it("references only same-origin icon assets", () => {
    for (const icon of m.icons ?? []) {
      expect(icon.src.startsWith("/icons/")).toBe(true);
      expect(icon.type).toBe("image/png");
    }
  });
});
