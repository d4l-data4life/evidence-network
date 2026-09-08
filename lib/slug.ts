// Slug helpers for human-friendly, unique URLs.

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Produce a slug from `base` that is unique according to `exists`. Appends a
 * short numeric suffix on collision (foo, foo-2, foo-3, …). Falls back to a
 * random suffix if `base` slugifies to empty.
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || `item-${Math.floor(performance.now())}`;
  let candidate = root;
  let n = 1;
  while (await exists(candidate)) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}
