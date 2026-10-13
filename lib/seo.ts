import { applicationOrigin } from "./config";

const localOrigin = "http://localhost:3000";

/**
 * Return one stable public origin for every search-facing URL.
 *
 * The deployed apex redirects to www, so using the apex in a canonical or
 * sitemap URL creates an avoidable redirect hop. `SEO_CANONICAL_ORIGIN` is an
 * explicit override for future host changes; the current production alias is
 * normalized only when APP_URL is the apex and no override is supplied.
 */
export function seoOrigin(env: Record<string, string | undefined> = process.env): string {
  const override = env.SEO_CANONICAL_ORIGIN?.trim();
  if (override) return applicationOrigin(override);

  try {
    const origin = applicationOrigin(env.APP_URL);
    const url = new URL(origin);
    if (url.protocol === "https:" && url.hostname === "reachflow.lol") {
      url.hostname = "www.reachflow.lol";
    }
    return url.origin;
  } catch {
    // Local builds and previews may not have deployment configuration yet.
    // Production should always set APP_URL (and ideally the explicit override).
    return localOrigin;
  }
}
