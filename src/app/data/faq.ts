/** Structure only. Every visible FAQ string lives in `src/i18n/<lang>.json` under `faq`. */
export interface FaqCategory {
  id: 'general' | 'account' | 'content' | 'legal' | 'technical';
  icon: string;
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  { id: 'general', icon: 'pi pi-question-circle' },
  { id: 'account', icon: 'pi pi-user' },
  { id: 'content', icon: 'pi pi-desktop' },
  { id: 'legal', icon: 'pi pi-file' },
  { id: 'technical', icon: 'pi pi-wrench' },
];
