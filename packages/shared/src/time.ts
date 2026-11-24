const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Returns the calendar date string (YYYY-MM-DD) in Asia/Jakarta (UTC+7 / WIB).
 */
export function getWibDateString(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Returns the ISO-8601 timestamp (with +07:00 offset) of the next 00:00 WIB reset.
 */
export function getNextWibMidnightIso(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  const nextDayUtcMs = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  const nextMidnightUtc = new Date(nextDayUtcMs - WIB_OFFSET_MS);
  const nextWibShifted = new Date(nextMidnightUtc.getTime() + WIB_OFFSET_MS);
  return `${nextWibShifted.toISOString().slice(0, 19)}+07:00`;
}
