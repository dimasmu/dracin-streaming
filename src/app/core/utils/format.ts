export function monogram(title: string): string {
  const initials = title
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, '').charAt(0))
    .join('')
    .toUpperCase();
  if (initials) return initials.slice(0, 3);
  const letters = title.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return letters.slice(0, 2) || 'D';
}

/**
 * "7 Jun 2024" in the website language. `tba` is what to show when neither a
 * date nor a year is known, so the caller can translate it.
 */
export function formatAired(dateStr?: string, year?: number, lang = 'en', tba = 'TBA'): string {
  if (!dateStr && !year) return tba;
  if (!dateStr) return String(year);
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return String(dateStr);
  const date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  if (isNaN(date.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
export function formatDuration(totalEpisodes?: number, durationMinutes = 1): string {
  const mins = (totalEpisodes ?? 0) * durationMinutes;
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  return `${mins}m`;
}

export function ratingStars(rating?: number): number {
  if (typeof rating !== 'number' || !isFinite(rating)) return 0;
  return Math.round(rating / 2);
}

export function clamp(value: string | number, max: number): string {
  return String(value).length > max ? String(value).slice(0, max) : String(value);
}

/** "ID / EN" - the video versions a drama is available in. */
export function videoLangLabel(langs: readonly string[], sep = ' / '): string {
  return langs.map((l) => l.toUpperCase()).join(sep);
}

/** Detects tiny HTTP-404 placeholder thumbnails (e.g. YouTube 120x90 grey tiles). */
export function isPlaceholderImage(event: Event): boolean {
  const img = event.target as HTMLImageElement | null;
  return Boolean(img && img.naturalWidth > 0 && img.naturalWidth <= 160 && img.naturalHeight <= 120);
}

/** Formats a local Date instance as YYYY-MM-DD without UTC timezone drift. */
export function toIsoDate(date: Date | null | undefined): string {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses YYYY-MM-DD into a local Date instance, or null when empty/invalid. */
export function parseIsoDate(value?: string | null): Date | null {
  if (!value) return null;
  const parts = String(value).trim().split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return isNaN(parsed.getTime()) ? null : parsed;
}
