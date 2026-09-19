/** Mirrors the API's slug rules: lowercase a-z/0-9 groups joined by single hyphens, max 48. */
export const SLUG_MAX_LENGTH = 48;

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // drop accents: "é" -> "e"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}
