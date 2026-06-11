import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Phone, Clock, Navigation } from "lucide-react";

import { clientEnv } from "@/lib/env";
import {
  SHOP_NAME,
  SHOP_ADDRESS,
  SHOP_ADDRESS_ONE_LINE,
  SHOP_PHONE_DISPLAY,
  SHOP_PHONE_TEL,
  HOURS_SUMMARY,
  getMapEmbedSrc,
  getDirectionsUrl,
} from "@/lib/location";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/common/Mascot";
import { OpenStatusBadge } from "@/components/about/OpenStatusBadge";

export const metadata: Metadata = {
  title: "Visit Us",
  description: `Find ${SHOP_NAME} at ${SHOP_ADDRESS_ONE_LINE}. Hours, directions, and contact.`,
};

const mapSrc = getMapEmbedSrc(clientEnv.NEXT_PUBLIC_MAPS_EMBED);
const directionsUrl = getDirectionsUrl();

function SectionLabel({
  icon: Icon,
  id,
  children,
}: {
  icon: typeof MapPin;
  id?: string;
  children: string;
}) {
  return (
    <div className="flex items-center gap-2 text-fg-secondary">
      <Icon className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
      <h2 id={id} className="text-headline text-foreground">
        {children}
      </h2>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto flex min-h-screen-safe w-full max-w-[480px] flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-title2 text-foreground">Visit us</h1>
        <p className="text-body text-fg-secondary">
          Come say hola. Here&rsquo;s where to find us, when we&rsquo;re open, and how to get in
          touch. 🌮
        </p>
      </header>

      {/* Map — third-party iframe, framed on --bg-tertiary, never color-inverted. */}
      <section aria-labelledby="map-heading" className="flex flex-col gap-3">
        <h2 id="map-heading" className="sr-only">
          Map
        </h2>
        <div className="overflow-hidden rounded-2xl border border-separator bg-card">
          <iframe
            title={`Map showing ${SHOP_NAME} at ${SHOP_ADDRESS_ONE_LINE}`}
            src={mapSrc}
            className="aspect-[4/3] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>

        {/* Text alternative to the map so the location is available without it. */}
        <address className="flex items-start gap-2 not-italic">
          <MapPin
            className="mt-0.5 size-5 shrink-0 text-dc-red-text"
            aria-hidden="true"
            strokeWidth={1.75}
          />
          <p className="select-text text-body text-foreground">
            <span className="font-medium">{SHOP_NAME}</span>
            <br />
            {SHOP_ADDRESS.line1}
            <br />
            {SHOP_ADDRESS.city}, {SHOP_ADDRESS.state} {SHOP_ADDRESS.zip}
          </p>
        </address>

        <Button asChild size="lg" className="w-full">
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
            <Navigation aria-hidden="true" />
            Get directions
          </a>
        </Button>
      </section>

      {/* Hours + live open/closed status. */}
      <section aria-labelledby="hours-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-fg-secondary">
            <Clock className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
            <h2 id="hours-heading" className="text-headline text-foreground">
              Hours
            </h2>
          </div>
          <OpenStatusBadge />
        </div>
        <dl className="flex flex-col gap-2 rounded-2xl bg-card p-5 shadow-card dark:shadow-card-dark">
          {HOURS_SUMMARY.map((row, i) => (
            <div
              key={row.label}
              className={cn(
                "flex items-baseline justify-between gap-4",
                i > 0 && "border-t border-separator pt-2",
              )}
            >
              <dt className="text-body text-foreground">{row.label}</dt>
              <dd
                className={cn(
                  "text-body tabular-nums",
                  row.value === "Closed" ? "text-fg-tertiary" : "text-fg-secondary",
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Contact — tap-to-call. */}
      <section aria-labelledby="contact-heading" className="flex flex-col gap-3">
        <SectionLabel icon={Phone} id="contact-heading">Contact</SectionLabel>
        <a
          href={`tel:${SHOP_PHONE_TEL}`}
          className="flex min-h-11 items-center gap-3 rounded-2xl bg-card px-5 py-3 text-body text-foreground shadow-card transition-colors hover:bg-fill-quaternary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:shadow-card-dark"
        >
          <Phone className="size-5 shrink-0 text-dc-red-text" aria-hidden="true" strokeWidth={1.75} />
          <span className="flex flex-col">
            <span className="font-medium">{SHOP_PHONE_DISPLAY}</span>
            <span className="text-footnote text-fg-secondary">Tap to call</span>
          </span>
        </a>
      </section>

      {/* About the shop + mascot. */}
      <section
        aria-labelledby="story-heading"
        className="flex flex-col items-center gap-4 rounded-2xl bg-surface-secondary p-6 text-center"
      >
        <Mascot expression="welcome" size={88} />
        <h2 id="story-heading" className="text-headline text-foreground">
          A little about us
        </h2>
        <p className="text-body text-fg-secondary">
          We&rsquo;ve been serving Arvada hand-made tacos, sizzling fajitas, and breakfast
          burritos worth waking up for since day one. Stop by, grab a stamp, and let us take care
          of the rest. We can&rsquo;t wait to see you.
        </p>
        <Button asChild variant="tertiary">
          <Link href="/menu">See the menu</Link>
        </Button>
      </section>
    </main>
  );
}
