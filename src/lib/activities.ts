import type { Activity, ActivityCategory, ActivityCategorySlug } from "./database.types";

export function categoryBySlug(
  categories: ActivityCategory[],
  slug: ActivityCategorySlug
): ActivityCategory | undefined {
  return categories.find((c) => c.slug === slug);
}

export function categoryOf(
  activity: Activity,
  categories: ActivityCategory[]
): ActivityCategory | undefined {
  return categories.find((c) => c.id === activity.category_id);
}

/** Categories enabled in this workspace, in their canonical sort order.
 *  Empty enabled_categories array = all categories enabled. */
export function enabledCategories(
  workspaceEnabled: string[],
  allCategories: ActivityCategory[]
): ActivityCategory[] {
  const sorted = [...allCategories].sort((a, b) => a.sort_order - b.sort_order);
  if (workspaceEnabled.length === 0) return sorted;
  return sorted.filter((c) => workspaceEnabled.includes(c.id));
}

/** Calculate age (in years) from a YYYY-MM-DD birth date. */
export function personAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
