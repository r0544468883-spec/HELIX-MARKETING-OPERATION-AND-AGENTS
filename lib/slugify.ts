export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9֐-׿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

// slug לשם כלי גלובלי (למשל "Notion" -> "notion", "Google Ads" -> "google-ads")
export function toolSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9א-ת]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
