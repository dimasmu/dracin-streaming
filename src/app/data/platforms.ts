import type { DramaPlatform } from '../core/models/platform';

// Source-platform directory. These are real third-party platforms referenced
// as the origin of each drama; DRA.CIN has no affiliation or partnership
// with any of them. No official logos are reproduced.
export const PLATFORMS: DramaPlatform[] = [
  { id: 'anireels', name: 'Anireels', description: 'Short-form vertical drama series.', tone: 'oklch(65% .16 299)' },
  { id: 'bilibili-short', name: 'BiliBili Short', description: 'Short drama channel from the Bilibili ecosystem.', tone: 'oklch(72% .16 310)' },
  { id: 'candyjar', name: 'CandyJar', description: 'Bite-sized romance and family dramas.', tone: 'oklch(68% .16 354)' },
  { id: 'dramabox', name: 'DramaBox', description: 'Popular short drama streaming platform.', tone: 'oklch(65% .16 255)' },
  { id: 'dramatv', name: 'DramaTV', description: 'Curated Chinese short drama catalogue.', tone: 'oklch(68% .16 332)' },
  { id: 'flareflow', name: 'FlareFlow', description: 'Fast-paced mini-series streaming.', tone: 'oklch(71% .16 255)' },
  { id: 'freedrama', name: 'FreeDrama', description: 'Free-to-watch short drama library.', tone: 'oklch(66% .16 266)' },
  { id: 'goodshort', name: 'GoodShort', description: 'Short drama app with daily updates.', tone: 'oklch(69% .16 310)' },
  { id: 'mydrama', name: 'MyDrama', description: 'Personalised short drama picks.', tone: 'oklch(70% .16 321)' },
  { id: 'netshort', name: 'NetShort', description: 'Network of short drama series.', tone: 'oklch(69% .16 332)' },
  { id: 'reelshort', name: 'ReelShort', description: 'Reel-style short drama streaming.', tone: 'oklch(72% .16 266)' },
];
