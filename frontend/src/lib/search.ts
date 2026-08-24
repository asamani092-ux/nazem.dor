/** Time O(n) per field scan. Space O(1). */
function normalizeArabic(s: string): string {
  return s
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Time O(n·m) where n=fields, m=query length. Space O(1). */
export function matchQuery(query: string, fields: string[]): boolean {
  const q = normalizeArabic(query);
  if (!q) return true;
  const tokens = q.split(' ').filter(Boolean);
  const hay = normalizeArabic(fields.join(' '));
  return tokens.every((t) => hay.includes(t));
}
