const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

export function formatAired(dateStr?: string, year?: number): string {
  if (!dateStr && !year) return 'TBA';
  if (!dateStr) return String(year);
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return String(dateStr);
  const m = MONTHS[Number(parts[1]) - 1];
  if (!m) return String(dateStr);
  return `${Number(parts[2])} ${m} ${parts[0]}`;
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
