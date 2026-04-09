export type ActivityCategorySlug = "film" | "braetspil" | "lege" | "kreative" | "andre";

export type ActivityCategory = {
  id: string;
  slug: ActivityCategorySlug;
  name: string;
  sort_order: number;
};

export type Workspace = {
  id: string;
  name: string;
  rewatch_cooldown_months: number | null;
  enabled_categories: string[];
  /** Default bedtime on weekdays (Sunday-Thursday), "HH:MM". */
  default_bedtime_weekday: string;
  /** Default bedtime on weekends (Friday-Saturday), "HH:MM". */
  default_bedtime_weekend: string;
  /** Minutes spent on the evening routine between the last activity and sleep. */
  evening_routine_minutes: number;
  created_at: string;
};

export type Person = {
  id: string;
  workspace_id: string;
  name: string;
  birth_date: string;
  is_workspace_admin: boolean;
  /** Optional per-person weekday bedtime override ("HH:MM"); null = use workspace default. */
  bedtime_weekday: string | null;
  /** Optional per-person weekend bedtime override ("HH:MM"); null = use workspace default. */
  bedtime_weekend: string | null;
  created_at: string;
};

export type Activity = {
  id: string;
  workspace_id: string;
  category_id: string;
  title: string;
  added_by: string | null;
  created_at: string;
  // Shared
  description: string | null;
  min_age: number;
  duration_minutes: number | null;
  image_url: string;
  info_url: string | null;
  // External source IDs
  tmdb_id: number | null;
  bgg_id: number | null;
  // Board game-specific
  min_players: number | null;
  max_players: number | null;
  // Indoor / outdoor
  indoor: boolean | null;
};

export type Rating = {
  id: string;
  activity_id: string;
  person_id: string;
  rating: number;
  updated_at: string;
};

export type Viewing = {
  id: string;
  activity_id: string;
  workspace_id: string;
  done_at: string;
  viewers: string[];
};

export type StreamingPlatform = {
  id: string;
  name: string;
  created_at: string;
};

export type WorkspacePlatform = {
  id: string;
  workspace_id: string;
  platform_id: string;
};

export type WorkspacePlatformEditor = {
  id: string;
  workspace_id: string;
  person_id: string;
};

export type ActivityPlatform = {
  id: string;
  activity_id: string;
  platform_id: string;
  workspace_id: string;
};

export type RedoRequest = {
  id: string;
  activity_id: string;
  person_id: string;
  workspace_id: string;
  created_at: string;
};
