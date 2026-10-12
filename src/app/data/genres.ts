import type { DramaGenre } from '../core/models/genre';

// Curated genre metadata for the prototype. Counts are derived from the
// drama catalogue at runtime, not stored here.
export const GENRES: DramaGenre[] = [
  { id: 'action', name: 'Action', description: 'Martial artists, hidden heroes and high-stakes showdowns.', tone: 'oklch(66% .16 288)' },
  { id: 'ceo', name: 'CEO', description: 'Billionaire romances and boardroom power plays.', tone: 'oklch(70% .16 299)' },
  { id: 'comedy', name: 'Comedy', description: 'Light-hearted mishaps and feel-good laughs.', tone: 'oklch(72% .16 266)' },
  { id: 'drama', name: 'Drama', description: 'Gripping everyday stories with emotional depth.', tone: 'oklch(67% .16 332)' },
  { id: 'family', name: 'Family', description: 'Bonds, secrets and reconciliation between loved ones.', tone: 'oklch(67% .16 310)' },
  { id: 'fantasy', name: 'Fantasy', description: 'Supernatural powers and worlds beyond our own.', tone: 'oklch(72% .16 288)' },
  { id: 'melodrama', name: 'Melodrama', description: 'Intense, heart-wrenching tales of love and loss.', tone: 'oklch(65% .16 255)' },
  { id: 'mystery', name: 'Mystery', description: 'Twists, secrets and questions that pull you in.', tone: 'oklch(71% .16 255)' },
  { id: 'revenge', name: 'Revenge', description: 'Redemption through payback and second chances.', tone: 'oklch(74% .16 277)' },
  { id: 'romance', name: 'Romance', description: 'Love stories across every circumstance and status.', tone: 'oklch(69% .16 288)' },
];
