export interface FaqItem {
  category: string;
  q: string;
  a: string;
}

export interface FaqCategory {
  id: string;
  name: string;
  icon: string;
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  { id: 'general', name: 'General', icon: 'pi pi-question-circle' },
  { id: 'account', name: 'Account', icon: 'pi pi-user' },
  { id: 'content', name: 'Content & Metadata', icon: 'pi pi-desktop' },
  { id: 'legal', name: 'Legal & Policy', icon: 'pi pi-file' },
  { id: 'technical', name: 'Technical', icon: 'pi pi-wrench' },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    category: 'general',
    q: 'What is DRA.CIN?',
    a: 'DRA.CIN is a metadata directory for Chinese short dramas. It helps you discover and browse series by genre and source platform, showing titles, synopses, episode counts and platform information. It does not stream video content.',
  },
  {
    category: 'general',
    q: 'Is DRA.CIN free to use?',
    a: 'Yes. Accessing and using DRA.CIN is free. It is a visual prototype that functions as a metadata directory, not a paid streaming service.',
  },
  {
    category: 'general',
    q: 'Where can I watch the listed dramas?',
    a: 'Each drama records its source platform (for example DramaBox, ReelShort or Anireels). Visit that platform to watch. DRA.CIN does not guarantee availability on any third-party platform.',
  },
  {
    category: 'general',
    q: 'Is the metadata always accurate?',
    a: 'DRA.CIN gathers metadata from public sources and tries to keep it accurate, but does not guarantee completeness. If you find a mistake, report it via the Contact page.',
  },
  {
    category: 'general',
    q: 'What subtitle languages are available?',
    a: 'DRA.CIN supports English (EN) and Indonesian (ID) subtitle modes. Your subtitle preference is stored locally in your browser and needs no login.',
  },
  {
    category: 'account',
    q: 'Do I need an account to use DRA.CIN?',
    a: 'No. Browsing, searching, and viewing metadata work without an account. Bookmarks are stored locally in your browser.',
  },
  {
    category: 'account',
    q: 'How do bookmarks work?',
    a: 'Tap the bookmark icon on any drama card to save it. Bookmarks are stored in your browser\u2019s local storage and are available across visits on the same device.',
  },
  {
    category: 'account',
    q: 'Is my personal data safe?',
    a: 'DRA.CIN only stores your subtitle and theme preferences locally in your browser via localStorage. No personal data is sent to a server. See the Privacy policy for details.',
  },
  {
    category: 'content',
    q: 'How do I search for a specific drama?',
    a: 'Use the search box in the header to type a title. You can also browse by genre, platform, or release schedule, or apply filters on the Browse page.',
  },
  {
    category: 'content',
    q: 'How can I see the latest dramas?',
    a: 'The homepage sections "Trending Now" and "Recently Updated" list recently added or updated titles. On the Browse page, use the "Newest" sort option.',
  },
  {
    category: 'content',
    q: 'Are the ratings verified?',
    a: 'Ratings shown in this prototype are illustrative demo values and are not independently verified. Treat them as a rough reference only.',
  },
  {
    category: 'content',
    q: 'How do I report a missing or incorrect drama?',
    a: 'Use the Contact page to report inaccurate metadata, duplicate titles, or dramas no longer available on their source platform.',
  },
  {
    category: 'legal',
    q: 'Does DRA.CIN infringe copyright?',
    a: 'DRA.CIN is a metadata directory, not a streaming platform. It does not host or play video files. Rights to original material remain with their owners. See the DMCA policy for removal requests.',
  },
  {
    category: 'legal',
    q: 'Are there fees for content use?',
    a: 'Using DRA.CIN to browse metadata is free. Watching on third-party streaming platforms may be subject to their own subscription fees.',
  },
  {
    category: 'legal',
    q: 'Where can I read the full terms?',
    a: 'The full Terms of Service, Privacy policy and DMCA policy are available from the footer of every page.',
  },
  {
    category: 'technical',
    q: 'Why does the page not display correctly?',
    a: 'Make sure you are using an up-to-date browser (Chrome, Firefox, Edge or Safari). Clearing your browser cache can also help.',
  },
  {
    category: 'technical',
    q: 'Is DRA.CIN available on mobile?',
    a: 'Yes. DRA.CIN is responsive and adapts to mobile, tablet and desktop screens.',
  },
  {
    category: 'technical',
    q: 'Why does the video not play on DRA.CIN?',
    a: 'DRA.CIN is not a streaming platform and does not provide a real video player. The watch page is a demo UI \u2014 follow the source platform link to watch.',
  },
];
