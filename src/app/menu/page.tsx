import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { getMenu } from "@/lib/menu";
import { MenuItem } from "@/components/menu/MenuItem";
import { CategoryNav, type NavCategory } from "@/components/menu/CategoryNav";
import { Mascot } from "@/components/common/Mascot";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Browse the Don Carlos menu — tacos, burritos, breakfast, quesadillas, tortas, and more.",
};

/**
 * Menu page (PLAN.md §Phase 7). Public, browse-only — no auth required (the
 * menu tables are public-read via RLS). Server Component: fetches all active
 * categories + items and renders photography-forward `MenuItem` cards grouped
 * into sticky-nav sections.
 *
 * Heading hierarchy: one h1 ("Menu"), each category an h2, each item an h3
 * (in MenuItem) — DESIGN_SYSTEM §9.
 */
export default async function MenuPage() {
  const supabase = await createClient();
  const menu = await getMenu(supabase);

  const navCategories: NavCategory[] = menu.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
  }));

  const hasAnyItems = menu.some((c) => c.items.length > 0);

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pb-16">
      <header className="flex flex-col gap-1 pt-10">
        <p className="text-body text-fg-secondary">Don Carlos</p>
        <h1 className="text-title2 text-foreground">Menu</h1>
      </header>

      {navCategories.length > 0 ? (
        <div className="mt-4">
          <CategoryNav categories={navCategories} />
        </div>
      ) : null}

      {hasAnyItems ? (
        <div className="mt-6 flex flex-col gap-10">
          {menu.map((category) => (
            <section
              key={category.id}
              id={`category-${category.slug}`}
              aria-labelledby={`heading-${category.slug}`}
              // Offset the scroll target so the sticky nav doesn't cover the heading.
              className="scroll-mt-20"
            >
              <h2
                id={`heading-${category.slug}`}
                className="mb-3 text-headline text-foreground"
              >
                {category.name}
              </h2>

              {category.items.length > 0 ? (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {category.items.map((item) => (
                    <li key={item.id}>
                      <MenuItem item={item} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-secondary py-10 text-center">
                  <Mascot expression="empty" size={64} />
                  <p className="text-footnote text-fg-secondary">
                    Nothing here yet — check back soon.
                  </p>
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <Mascot expression="empty" size={96} label="No menu items" decorative={false} />
          <p className="text-headline text-foreground">Menu coming soon</p>
          <p className="max-w-[320px] text-footnote text-fg-secondary">
            We&apos;re still plating things up. Check back shortly for the full Don
            Carlos menu.
          </p>
        </div>
      )}
    </main>
  );
}
