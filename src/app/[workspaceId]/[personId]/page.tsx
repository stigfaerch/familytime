import { PersonPageClient, type FeatureFlags } from "./PersonPageClient";

// Server component: reads feature flags from the environment at request time
// so the client knows which integrations to expose, without round-tripping a
// /api/config call. Self-hosters who do not configure an external API just
// see the corresponding feature disappear from the UI.
export default function PersonPage() {
  const features: FeatureFlags = {
    tmdb: !!process.env.TMDB_API_KEY,
    bgg: !!process.env.BGG_API_TOKEN,
    unsplash: !!process.env.UNSPLASH_ACCESS_KEY,
  };
  return <PersonPageClient features={features} />;
}
