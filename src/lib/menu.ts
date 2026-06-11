/**
 * Menu data access (PLAN.md §Phase 7). Public-read via RLS — no auth needed.
 *
 * The `menu_categories` / `menu_items` tables were seeded in Phase 2 (7
 * categories, 28 items). We fetch both, order by `sort_order`, and group items
 * under their category in a single typed shape the Server Component can render.
 */
import type { Database } from "@/lib/database.types";
import type { createClient } from "@/lib/supabase/server";

export type MenuItemRow = Database["public"]["Tables"]["menu_items"]["Row"];
export type MenuCategoryRow = Database["public"]["Tables"]["menu_categories"]["Row"];

/** A category with its (already sort-ordered) active items attached. */
export type MenuCategoryWithItems = MenuCategoryRow & {
  items: MenuItemRow[];
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Fetch active categories + active items, grouped and ordered by `sort_order`.
 *
 * Two queries run in parallel (categories, items) rather than a nested join so
 * the ordering of each is explicit and stable. Empty categories are still
 * returned so the UI can render their EmptyState (DESIGN_SYSTEM §5.13).
 */
export async function getMenu(
  supabase: SupabaseServerClient,
): Promise<MenuCategoryWithItems[]> {
  const [{ data: categories, error: catError }, { data: items, error: itemError }] =
    await Promise.all([
      supabase
        .from("menu_categories")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("menu_items")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
    ]);

  if (catError) throw catError;
  if (itemError) throw itemError;

  const itemsByCategory = new Map<string, MenuItemRow[]>();
  for (const item of items ?? []) {
    const bucket = itemsByCategory.get(item.category_id);
    if (bucket) {
      bucket.push(item);
    } else {
      itemsByCategory.set(item.category_id, [item]);
    }
  }

  return (categories ?? []).map((category) => ({
    ...category,
    items: itemsByCategory.get(category.id) ?? [],
  }));
}
