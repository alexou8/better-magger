/** Validate and bound stored preferences rather than trusting browser storage. */
export function parseRecentColors(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((s): s is string => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s)).map(s => s.toLowerCase()))].slice(0, 6);
  } catch {
    return [];
  }
}
