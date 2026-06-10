import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * Don Carlos Rewards — Tailwind v3 design-token contract.
 *
 * Tokens map to CSS custom properties defined in `src/app/globals.css`
 * (light + dark blocks). See DESIGN_SYSTEM.md §2–4 and BLUEPRINT.md §3.
 *
 * Color format: solid colors are stored as space-separated RGB channels and
 * consumed via `rgb(var(--x) / <alpha-value>)` so Tailwind opacity modifiers
 * (e.g. `bg-dc-red/90`) work. Mode-aware translucent tokens (separator,
 * secondary/tertiary text, fills) carry their alpha inside the variable and are
 * consumed as plain `var(--x)`.
 *
 * Dark mode: `media` — follows OS `prefers-color-scheme` (DESIGN_SYSTEM §10).
 */
const config: Config = {
  darkMode: "media",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ---- shadcn/ui semantic tokens (alpha-capable channels) ----
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },

        // ---- Don Carlos brand (constant across light/dark) ----
        "dc-red": "rgb(var(--dc-red) / <alpha-value>)",
        "dc-yellow": "rgb(var(--dc-yellow) / <alpha-value>)",
        "dc-green": "rgb(var(--dc-green) / <alpha-value>)",
        // Mode-aware darkened brand red for red TEXT (AA on white / on black).
        "dc-red-text": "rgb(var(--dc-red-text) / <alpha-value>)",
        // AA brand-red FILL for white labels (primary button, default badge).
        "dc-red-fill": "rgb(var(--dc-red-fill) / <alpha-value>)",
        // Dark olive text for fresh/menu tags on a dc-green tint (AA).
        "dc-green-text": "rgb(var(--dc-green-text) / <alpha-value>)",

        // ---- Apple semantic colors (fills/icons; *-text = AA text variants) ----
        success: "rgb(var(--success) / <alpha-value>)",
        "success-text": "rgb(var(--success-text) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        "warning-text": "rgb(var(--warning-text) / <alpha-value>)",
        error: "rgb(var(--error) / <alpha-value>)",
        "error-text": "rgb(var(--error-text) / <alpha-value>)",

        // ---- Design-system surfaces (channels, alpha-capable) ----
        surface: {
          DEFAULT: "rgb(var(--bg-primary) / <alpha-value>)",
          secondary: "rgb(var(--bg-secondary) / <alpha-value>)",
          tertiary: "rgb(var(--bg-tertiary) / <alpha-value>)",
        },

        // ---- Mode-aware translucent tokens (alpha baked in) ----
        separator: "var(--separator)",
        "fg-secondary": "var(--text-secondary)",
        "fg-tertiary": "var(--text-tertiary)",
        "fill-quaternary": "var(--fill-quaternary)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "SF Pro Display",
          "SF Pro Text",
          "system-ui",
          "sans-serif",
        ],
      },
      // Apple HIG type ramp — [size, { lineHeight, fontWeight, letterSpacing }]
      fontSize: {
        caption: ["11px", { lineHeight: "1.3", fontWeight: "400" }],
        footnote: ["13px", { lineHeight: "1.35", fontWeight: "400" }],
        body: ["17px", { lineHeight: "1.4", fontWeight: "400" }],
        "body-emph": ["17px", { lineHeight: "1.4", fontWeight: "600" }],
        headline: ["22px", { lineHeight: "1.2", fontWeight: "600" }],
        title3: ["28px", { lineHeight: "1.15", fontWeight: "600" }],
        title2: ["34px", { lineHeight: "1.1", fontWeight: "700", letterSpacing: "-0.02em" }],
        "large-title": [
          "48px",
          { lineHeight: "1.05", fontWeight: "700", letterSpacing: "-0.02em" },
        ],
      },
      borderRadius: {
        // shadcn radius scale (driven by --radius = 12px / buttons & inputs)
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // DESIGN_SYSTEM §4.3 — 2xl(16) list/menu, 3xl(24) hero already match TW defaults.
      },
      spacing: {
        18: "4.5rem", // 72px — BLUEPRINT §3 sketch
      },
      boxShadow: {
        // DESIGN_SYSTEM §4.3 — soft elevation; dark variants applied via `dark:` utilities.
        card: "0 2px 8px rgba(0,0,0,0.08)",
        "card-dark": "0 2px 8px rgba(0,0,0,0.4)",
        "card-hero": "0 8px 24px rgba(0,0,0,0.10)",
        "card-hero-dark": "0 8px 24px rgba(0,0,0,0.5)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
};

export default config;
