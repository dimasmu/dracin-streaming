/**
 * Single source for facts shared by the legal pages and the contact page.
 * Swap these for real values (or an API response) when a backend exists.
 */

/** Placeholder addresses on a reserved domain: they cannot receive mail. */
export const LEGAL_CONTACT = {
  general: 'hello@tiraiplay.example',
  dmca: 'dmca@tiraiplay.example',
} as const;

export type LegalDocKey = 'terms' | 'privacy' | 'dmca';

export interface LegalDoc {
  key: LegalDocKey;
  path: string;
  /** Shown only when the document is versioned. */
  version?: string;
  /** ISO dates. Static until a backend serves document metadata. */
  effective: string;
  updated?: string;
}

export const LEGAL_DOCS: readonly LegalDoc[] = [
  { key: 'terms', path: '/terms', version: '1.0', effective: '2026-01-01', updated: '2026-01-01' },
  { key: 'privacy', path: '/privacy', version: '1.0', effective: '2026-01-01', updated: '2026-01-01' },
  { key: 'dmca', path: '/dmca', effective: '2026-01-01' },
];

export interface LegalSection {
  /** Element id of the section or sub-heading this entry points to. */
  id: string;
  /** i18n key of the label. */
  labelKey: string;
  /** 2 = nested under the previous top-level entry. */
  level?: 1 | 2;
}
