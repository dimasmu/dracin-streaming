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
