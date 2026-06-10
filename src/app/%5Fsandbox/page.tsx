import type { CSSProperties } from "react";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mascot, type MascotExpression } from "@/components/common/Mascot";
import { TacoGlyph } from "@/components/common/TacoGlyph";
import { InteractiveDemos } from "./InteractiveDemos";

export const metadata = { title: "Design Sandbox" };

/**
 * CSS-variable overrides that force a dark-token render regardless of OS.
 *
 * NOTE: chained shadcn tokens (e.g. `--background: var(--bg-primary)`) are
 * substituted at `:root` and inherit their *computed* value, so overriding only
 * `--bg-primary` here would NOT update `--background` on this subtree. We
 * therefore set the resolved channel values directly. (Real OS dark mode is
 * unaffected — those overrides live at `:root` in globals.css.)
 */
const DARK_VARS: Record<string, string> = {
  // base neutral channels
  "--bg-primary": "0 0 0",
  "--bg-secondary": "28 28 30",
  "--bg-tertiary": "44 44 46",
  // translucent (alpha baked in)
  "--separator": "rgba(84,84,88,0.4)",
  "--text-secondary": "rgba(235,235,245,0.6)",
  "--text-tertiary": "rgba(235,235,245,0.3)",
  "--fill-quaternary": "rgba(118,118,128,0.16)",
  // resolved shadcn semantic tokens (cannot rely on chained var() here)
  "--background": "0 0 0",
  "--foreground": "255 255 255",
  "--card": "44 44 46",
  "--card-foreground": "255 255 255",
  "--popover": "44 44 46",
  "--popover-foreground": "255 255 255",
  "--secondary": "28 28 30",
  "--secondary-foreground": "255 255 255",
  "--muted": "28 28 30",
  "--muted-foreground": "152 152 159",
  "--accent": "28 28 30",
  "--accent-foreground": "255 255 255",
  "--border": "56 56 58",
  "--input": "56 56 58",
  // mode-aware red/semantic TEXT tokens (must mirror the @media dark block so
  // the forced-dark preview is faithful — see globals.css)
  "--dc-red-text": "255 107 107",
  "--success-text": "48 209 88",
  "--warning-text": "255 159 10",
  "--dc-green-text": "168 213 138",
  "--error-text": "255 107 107",
};

type Swatch = { name: string; className: string; note?: string };

const BRAND: Swatch[] = [
  { name: "dc-red", className: "bg-dc-red", note: "brand identity / fills" },
  { name: "dc-yellow", className: "bg-dc-yellow" },
  { name: "dc-green", className: "bg-dc-green" },
  { name: "dc-red-text", className: "bg-dc-red-text", note: "AA red text (mode-aware)" },
  { name: "dc-red-fill", className: "bg-dc-red-fill", note: "AA fill for white label" },
];
const SEMANTIC: Swatch[] = [
  { name: "success", className: "bg-success" },
  { name: "warning", className: "bg-warning" },
  { name: "error", className: "bg-error" },
];
const SURFACES: Swatch[] = [
  { name: "background", className: "bg-background" },
  { name: "surface-secondary", className: "bg-surface-secondary" },
  { name: "card / surface-tertiary", className: "bg-card" },
  { name: "muted", className: "bg-muted" },
];

const TYPE_RAMP: { token: string; cls: string; sample: string }[] = [
  { token: "large-title 48/700", cls: "text-large-title", sample: "Reward unlocked" },
  { token: "title2 34/700", cls: "text-title2", sample: "1,240 points" },
  { token: "title3 28/600", cls: "text-title3", sample: "Your Rewards" },
  { token: "headline 22/600", cls: "text-headline", sample: "Recent activity" },
  { token: "body 17/400", cls: "text-body", sample: "Earn a stamp with every visit." },
  { token: "body-emph 17/600", cls: "text-body-emph", sample: "Carne Asada Taco" },
  { token: "footnote 13/400", cls: "text-footnote", sample: "Today 2:14 PM · Balance 95" },
  { token: "caption 11/400", cls: "text-caption", sample: "Terms apply. Points expire never." },
];

const SPACING: { token: string; px: number }[] = [
  { token: "1", px: 4 },
  { token: "2", px: 8 },
  { token: "3", px: 12 },
  { token: "4", px: 16 },
  { token: "5", px: 20 },
  { token: "6", px: 24 },
  { token: "8", px: 32 },
  { token: "10", px: 40 },
  { token: "12", px: 48 },
  { token: "16", px: 64 },
];

const MASCOTS: MascotExpression[] = ["welcome", "celebrate", "empty", "error"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-headline text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function SwatchRow({ items }: { items: Swatch[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((s) => (
        <div key={s.name} className="flex flex-col gap-1.5">
          <div className={`size-16 rounded-2xl border border-separator ${s.className}`} />
          <span className="text-caption text-fg-secondary">{s.name}</span>
          {s.note && <span className="text-caption text-fg-tertiary">{s.note}</span>}
        </div>
      ))}
    </div>
  );
}

/** The full visual token + component showcase. Rendered once per mode. */
function Showcase({ interactive = false }: { interactive?: boolean }) {
  return (
    <div className="flex flex-col gap-10 rounded-3xl bg-background p-6 text-foreground">
      <Section title="Brand & semantic colors">
        <SwatchRow items={BRAND} />
        <SwatchRow items={SEMANTIC} />
      </Section>

      <Section title="Surfaces">
        <SwatchRow items={SURFACES} />
      </Section>

      <Section title="Text colors">
        <div className="flex flex-col gap-1">
          <p className="text-body text-foreground">foreground — primary text</p>
          <p className="text-body text-fg-secondary">fg-secondary — captions & helper text</p>
          <p className="text-body text-fg-tertiary">fg-tertiary — disabled & placeholders</p>
          <p className="text-body text-dc-red-text">dc-red-text — brand red, AA (mode-aware)</p>
          <p className="text-body text-error-text">error-text — validation/destructive, AA</p>
          <p className="text-body text-success-text">success-text — on success tint, AA</p>
          <p className="text-body text-warning-text">warning-text — on warning tint, AA</p>
          <p className="text-body text-dc-green-text">dc-green-text — fresh tag on tint, AA</p>
        </div>
      </Section>

      <Section title="Type ramp">
        <div className="flex flex-col gap-3">
          {TYPE_RAMP.map((t) => (
            <div key={t.token} className="flex flex-col gap-0.5">
              <span className="text-caption text-fg-tertiary">{t.token}</span>
              <span className={`${t.cls} text-foreground`}>{t.sample}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Spacing scale (4px base)">
        <div className="flex flex-col gap-2">
          {SPACING.map((s) => (
            <div key={s.token} className="flex items-center gap-3">
              <span className="w-16 text-caption text-fg-secondary">
                space-{s.token} · {s.px}px
              </span>
              <div className="h-4 rounded bg-dc-red" style={{ width: s.px }} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="destructive">Delete account</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Reward ready</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">+25 earned</Badge>
          <Badge variant="fresh">Fresh</Badge>
          <Badge variant="warning">Pending</Badge>
          <Badge variant="destructive">Error</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </Section>

      <Section title="Card · Skeleton · Avatar">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Carne Asada Taco</CardTitle>
              <CardDescription>Grilled steak, cilantro, onion, salsa</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-body-emph tabular-nums text-foreground">$3.50</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Loading…</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Taco stamps & mascot">
        <div className="flex items-center gap-3">
          <TacoGlyph filled />
          <TacoGlyph filled />
          <TacoGlyph filled />
          <TacoGlyph />
          <TacoGlyph />
        </div>
        <div className="flex flex-wrap items-end gap-6">
          {MASCOTS.map((m) => (
            <div key={m} className="flex flex-col items-center gap-1.5">
              <Mascot expression={m} size={72} />
              <span className="text-caption text-fg-secondary">{m}</span>
            </div>
          ))}
        </div>
      </Section>

      {interactive && (
        <Section title="Interactive (dialog · sheet · dropdown · toast · tabs · forms)">
          <InteractiveDemos />
        </Section>
      )}
    </div>
  );
}

export default function SandboxPage() {
  // Dev-only route — 404 in production builds.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-title2 text-foreground">Design Sandbox</h1>
        <p className="text-body text-fg-secondary">
          Every token and base component for visual QA. Toggle your OS appearance to verify
          light/dark; a forced-dark preview is included below.
        </p>
      </header>

      <Showcase interactive />

      <section className="flex flex-col gap-4">
        <h2 className="text-headline text-foreground">Forced dark preview</h2>
        <p className="text-footnote text-fg-secondary">
          Rendered with dark tokens regardless of your OS setting.
        </p>
        <div style={DARK_VARS as CSSProperties}>
          <Showcase />
        </div>
      </section>
    </main>
  );
}
