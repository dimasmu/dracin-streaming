# Project: DRA.CIN — Chinese Short Drama Discovery & Streaming UI Prototype

## 1. Role and Objective

Act as a senior Angular frontend engineer and UI/UX designer specializing in modern streaming platforms, media discovery websites, responsive layouts, and reusable component architecture.

Build a complete, high-quality frontend prototype for **DRA.CIN**, a Chinese short-drama discovery and streaming interface.

The project already has an HTML/CSS/JavaScript prototype in the provided archive. You MUST inspect the existing files and use them as the primary design reference.

This is a migration and improvement project, not a completely new design.

Your objectives are to:
1. Migrate the existing prototype to Angular.
2. Use Tailwind CSS for layout, spacing, responsive behavior, and utility styling.
3. Use PrimeNG for interactive UI components where appropriate.
4. Preserve the existing DRA.CIN visual identity.
5. Improve the visual hierarchy, content metadata, navigation, responsiveness, accessibility, and interactions.
6. Populate all pages with realistic local mock data and legally usable image assets.
7. Complete the frontend without requiring a backend API.

Do not merely create a landing page or a static visual mockup. Implement a cohesive multi-page application with working client-side navigation and meaningful interactions.

## 2. Mandatory Initial Inspection

Before writing code, inspect the complete project archive.

Important files include:
- `index.html`
- `browse.html`
- `genre.html`
- `platform.html`
- `release-schedule.html`
- `dracin-watch.html`
- `faq.html`
- `contact.html`
- `dmca.html`
- `privacy.html`
- `terms.html`
- `assets/app.css`
- `assets/dracin-data.js`
- `assets/dracin.js`
- `DESIGN-HANDOFF.md`
- `DESIGN-MANIFEST.json`
- `brand-spec.md`

Inspect the remaining files and image assets as well.

First, identify:
- Existing design tokens and typography.
- Header, footer, navigation, and account menu.
- Homepage sections and content-card patterns.
- Page-specific layouts and interactions.
- Existing responsive behavior.
- Data fields, image mappings, and potential inconsistencies.
- Features that should be preserved, improved, or removed.

Use the actual contents of the files as the source of truth. Do not assume that every page follows the same layout.

After inspection, create a short implementation plan and proceed with implementation. Do not stop after producing the plan.

## 3. Technology Stack

Use the following frontend stack:

- Angular with standalone components.
- Angular Router for navigation.
- TypeScript with strict type checking.
- Tailwind CSS for styling and responsive layouts.
- PrimeNG for suitable interactive components.
- PrimeIcons for icons.
- RxJS and Angular signals where appropriate.
- Local TypeScript data files or JSON fixtures for mock content.
- LocalStorage for prototype-only preferences and bookmarks.

Use mutually compatible, stable versions of Angular, PrimeNG, PrimeIcons, and Tailwind CSS. Check the installed tooling and package compatibility before selecting versions.

Use Angular's supported integration approach for PrimeNG and Tailwind. Avoid maintaining two competing styling systems.

Do not use another component library such as Material, Bootstrap, or a second Tailwind component framework.

Use PrimeNG components selectively. Not every element needs to be a PrimeNG component.

Examples:
- PrimeNG Select for filters.
- PrimeNG Drawer for mobile navigation.
- PrimeNG Dialog for confirmations and detail previews.
- PrimeNG Paginator for paginated catalog results.
- PrimeNG Accordion for FAQs.
- PrimeNG Skeleton for loading states.
- PrimeNG Toast for feedback.
- PrimeNG InputText and Select for forms and search filters.

Use custom Angular components and Tailwind for content cards, navigation, hero sections, metadata labels, and other brand-specific elements.

## 4. Brand and Visual Direction

Preserve the DRA.CIN visual identity.

### Color system

Use the original stylesheet to extract exact colors before introducing new tokens.

The intended visual direction is:

- Background: near-black navy.
- Surface: elevated navy.
- Primary accent: electric indigo.
- Secondary status accent: cyan.
- Primary text: soft white.
- Secondary text: cool muted gray.
- Borders: subtle navy-gray.

Define reusable CSS variables and connect them to Tailwind theme tokens where supported.

Do not redesign the brand using generic purple gradients everywhere, excessive neon, glassmorphism, or large decorative gradients.

Use gradients only when they support the existing artwork and improve text readability.

### Typography

Preserve the existing typography pairing:
- Manrope for body text and UI.
- Barlow Condensed for display headings and selected prominent labels.

Reuse the supplied font files if technically appropriate.

### Visual quality

The interface should feel like a polished, modern streaming discovery platform.

Prioritize:
- Clear visual hierarchy.
- Consistent spacing and alignment.
- High-quality image crops.
- Readable metadata.
- Restrained hover animations.
- Clear active navigation states.
- Consistent border radii.
- Well-balanced content density.
- Responsive grids.
- Strong contrast and visible focus states.

Avoid excessive empty space, oversized generic cards, unnecessary borders, and repetitive information.

Keep the existing square 1:1 poster-card concept where it is part of the design. Improve it rather than replacing every card with a generic landscape card.

## 5. Application Structure

Create a maintainable Angular project organized by features and shared components.

Suggested structure:

src/app/
  core/
    services/
    models/
    guards/
  shared/
    components/
      app-header/
      app-footer/
      drama-card/
      drama-card-skeleton/
      drama-grid/
      search-bar/
      filter-toolbar/
      platform-badge/
      subtitle-badge/
      empty-state/
      pagination/
      breadcrumbs/
  features/
    home/
    browse/
    drama-detail/
    watch/
    genres/
    platforms/
    schedule/
    bookmarks/
    faq/
    contact/
    dmca/
    privacy/
    terms/
  data/
    dramas.ts
    genres.ts
    platforms.ts
    schedule.ts
  app.routes.ts

Adjust the structure when appropriate, but keep the architecture feature-oriented and reusable.

Requirements:
- Use strongly typed models.
- Avoid oversized components.
- Avoid duplicating the same header, footer, cards, or filters.
- Avoid unnecessary abstractions.
- Use standalone components and lazy-loaded routes where appropriate.
- Keep data, UI, routing, and presentation concerns separate.
- Use semantic HTML.
- Do not put all application logic in `app.component.ts`.

## 6. Required Pages and Routes

Implement all the existing prototype pages as real Angular routes.

### A. Home — `/`

Create a polished discovery homepage.

Include:
- Shared navigation header.
- Featured drama hero section using the existing visual direction.
- Featured drama artwork with title, synopsis, platform, subtitle availability, episode count, and genre.
- Primary action to open the drama details or watch page.
- Trending dramas.
- Recently updated dramas.
- Popular genres.
- Browse by platform.
- Recently added dramas.
- A compact release-schedule preview.
- Shared footer.

Improve the order and hierarchy of sections if needed.

Avoid making every section visually identical. Use restrained variations in layout to establish hierarchy.

### B. Browse — `/browse`

Create a complete searchable drama catalog.

Include:
- Page heading and result count.
- Search input.
- Genre filter.
- Platform filter.
- Subtitle-language filter.
- Release-year filter.
- Sort options such as recently added, latest release, rating, and title.
- Responsive poster grid.
- Pagination or a clearly implemented load-more interaction.
- Empty state with a clear reset-filters action.

Filters must actually change the displayed data.

Use sensible defaults and preserve filter state in URL query parameters when practical.

### C. Drama Details — `/drama/:slug`

Create a dedicated drama information page.

Include:
- Backdrop or banner artwork.
- Poster artwork.
- Title and alternate title.
- Synopsis.
- Genres.
- Platform.
- Release year and release date where known.
- Episode count.
- Latest episode.
- Subtitle languages.
- Rating when supported by a reliable source or explicitly marked as demo data.
- Drama status.
- Episode list or episode selector.
- Related dramas.
- Bookmark button.
- Primary watch action.

Use a layout that prioritizes the artwork, title, synopsis, and watch action without overwhelming the user with metadata.

### D. Watch — `/watch/:slug/:episode`

Create a frontend-only video-player prototype.

Include:
- Breadcrumbs.
- Player area with a representative poster or neutral placeholder.
- Play/pause simulation.
- Current episode and drama title.
- Previous and next episode navigation.
- Episode selector.
- Subtitle-language selector.
- Server selector.
- Volume and fullscreen controls only when meaningfully implemented.
- Like/dislike or feedback controls.
- Bookmark action.
- Episode list.
- Related dramas.

Do not pretend a real video is playing if no authorized playable media is available.

If the project has no licensed video asset, display a clearly styled demo player and a useful playback placeholder.

All controls must have sensible behavior, even if playback itself is simulated.

### E. Genres — `/genre`

Create a genre discovery page.

Include:
- Genre cards or sections.
- Drama counts derived from the local dataset.
- Genre descriptions.
- Navigation to filtered catalog results.
- Featured genres.
- Responsive layouts.

Use a controlled visual variation between genres rather than identical generic tiles.

### F. Platforms — `/platform`

Create a platform discovery page.

Include:
- Platform cards.
- Platform names and logos only when suitable assets are available.
- Drama counts.
- Short platform descriptions.
- Featured titles.
- Navigation to platform-filtered results.

Do not invent official platform logos or imply a partnership.

### G. Release Schedule — `/release-schedule`

Create a usable schedule page.

Include:
- Date navigation.
- Today and upcoming release sections.
- Day or date filters.
- Drama title, platform, episode number, subtitle status, and release time where known.
- Links to the corresponding drama or episode.
- A useful empty state.

Use a calendar-like or date-grouped layout that remains practical on mobile.

Distinguish actual sourced release information from illustrative demo schedules.

### H. Bookmarks — `/bookmarks`

Create a saved-drama page.

Include:
- Saved drama grid.
- Remove bookmark interaction.
- Empty state.
- Navigation back to browse.

Persist saved drama IDs using LocalStorage.

Bookmarks must work across route changes and browser refreshes.

### I. FAQ — `/faq`

Create a polished FAQ page.

Include:
- Searchable questions.
- Grouped categories.
- Expandable answers.
- Contact-support link.

Use PrimeNG Accordion where appropriate.

### J. Contact — `/contact`

Create a contact page with:
- Contact information.
- Clear form labels.
- Name, email, subject, and message.
- Client-side validation.
- Loading, success, and error feedback states.

Since there is no backend, submission must be a local simulation. Do not claim that a message was actually sent to a server.

### K. DMCA — `/dmca`

Create a complete, readable copyright policy page.

Include:
- Purpose and scope.
- Copyright infringement notification process.
- Required information for a notice.
- Counter-notification process where applicable.
- Contact details as configurable placeholders.
- A note to obtain legal review before publication.

Do not invent a real legal entity, registered agent, or official contact address.

### L. Privacy Policy — `/privacy`

Create a structured prototype privacy policy.

Include:
- Data collection.
- LocalStorage and preferences.
- Analytics placeholders.
- Third-party services.
- Data retention.
- User rights.
- Contact information.

Clearly mark sections requiring actual business practices or legal review.

### M. Terms — `/terms`

Create a structured terms-of-use page with:
- Acceptance of terms.
- Permitted use.
- Intellectual property.
- Third-party links.
- Availability and disclaimers.
- Changes to terms.
- Contact details.

Treat all policy content as a draft, not verified legal advice.

## 7. Data Model and Metadata Improvements

Create a typed `Drama` model that supports all required pages.

Suggested fields:

- `id`: stable identifier.
- `slug`: unique URL-friendly identifier.
- `title`: primary display title.
- `originalTitle`: original-language title when verified.
- `alternateTitles`: optional alternate titles.
- `synopsis`: short summary.
- `description`: optional longer synopsis.
- `posterUrl`: poster image.
- `backdropUrl`: banner or backdrop image.
- `genres`: array of genre identifiers.
- `platformId`: source platform identifier.
- `releaseYear`: year when known.
- `releaseDate`: optional ISO date.
- `totalEpisodes`: known episode count.
- `latestEpisode`: latest available episode number.
- `status`: ongoing, completed, upcoming, or unknown.
- `subtitleLanguages`: available language codes.
- `rating`: optional rating.
- `ratingSource`: optional rating source.
- `ratingIsDemo`: whether the rating is illustrative.
- `durationMinutes`: optional episode duration.
- `country`: optional country of origin.
- `cast`: optional list of credited cast members.
- `director`: optional director.
- `tags`: optional discovery tags.
- `featured`: boolean.
- `trendingScore`: optional internal demo-ranking value.
- `addedAt`: catalog insertion timestamp.
- `updatedAt`: catalog update timestamp.
- `episodes`: optional episode metadata.
- `dataSource`: provenance information.
- `isDemoData`: boolean indicating illustrative content.

Create separate typed models for:
- `DramaEpisode`
- `DramaGenre`
- `DramaPlatform`
- `ReleaseScheduleItem`
- `SubtitleLanguage`
- `Bookmark`

Do not populate every optional field with fabricated values.

Display only useful metadata that is available and relevant.

Do not confuse total episode count with the latest released episode. These must be separate fields.

Do not confuse original release date with the date a title was added to the catalog.

Do not assume that every platform supports every subtitle language.

## 8. Data and Image Collection

Populate the prototype with enough content to make every page visually convincing. Aim for approximately 30–50 drama entries if suitable, authorized metadata and artwork are available.

First, inspect the existing `dracin-data.js` and all supplied images. Reuse the existing assets when they are appropriate and legally usable.

Create a clear mapping between drama records and image files.

For missing images, prefer:
1. Official image assets that may lawfully be reused.
2. Images from sources whose licenses permit the intended use.
3. Licensed image APIs or public-domain assets.
4. Local neutral placeholders with the correct aspect ratio.

For public metadata research, use sources that permit the intended access and reuse. Respect source terms, copyright, robots policies, and rate limits.

You may collect publicly available metadata and artwork from authorized sources, but do not download unauthorized video streams, bypass access controls, evade anti-bot protections, or copy protected artwork without appropriate permission.

If an existing metadata source cannot be verified or accessed appropriately, use the supplied prototype data and clearly identified demo records instead.

For scraped or externally sourced fields:
- Preserve the source URL or source identifier.
- Record retrieval or verification date where practical.
- Distinguish sourced values from editorially curated values.
- Do not invent ratings, episode counts, cast members, release dates, or platform affiliations.
- Normalize inconsistent title casing and whitespace without destroying the original title.
- Do not silently replace missing values with fake data.

Implement the prototype so data can later be replaced by an API without rewriting the UI.

Use local fixtures for the current phase. Do not build a scraper service or backend as part of this task.

## 9. Drama Card Design

Create a reusable `DramaCardComponent`.

Preserve the original square-card concept where appropriate.

Each card should support:
- Poster artwork with consistent cropping.
- Title with a sensible line clamp.
- Current or latest episode.
- Platform badge.
- Subtitle-language badge.
- Optional release status.
- Optional rating when available.
- Bookmark action.
- Click navigation to the drama details page.

Improve the card interaction with:
- Subtle hover elevation.
- A restrained accent border or shadow.
- Image zoom kept within the card boundaries.
- Visible keyboard focus.
- Optional synopsis tooltip or overlay on desktop.
- Touch-friendly actions on mobile.

Do not reveal essential information exclusively on hover.

Handle missing artwork using a consistent placeholder. Prevent broken images from disrupting the grid.

Use CSS aspect ratios rather than hard-coded image heights wherever possible.

## 10. Header and Navigation

Implement one shared header across all routes.

Include:
- DRA.CIN logo or a faithful text-based recreation.
- Home.
- Genre.
- Platform.
- Schedule.
- Search.
- Subtitle-language preference.
- Theme control only if it can be implemented coherently with the brand.
- Account menu or a clearly labeled prototype profile menu.
- Bookmark navigation.

Preserve the original English/Indonesian subtitle preference concept.

Use accessible labels, visible active states, and appropriate mobile navigation.

Persist user preferences locally.

Do not implement fake authentication or imply that an actual account system exists.

## 11. Functional Requirements

The prototype must provide working frontend interactions.

Implement:
- Angular route navigation.
- Search by drama title and alternate title.
- Genre and platform filtering.
- Subtitle-language filtering.
- Sorting.
- Pagination or load-more behavior.
- Bookmark add/remove.
- Bookmark persistence.
- Episode navigation.
- Subtitle preference.
- Date selection on the schedule page.
- FAQ expansion and search.
- Contact form validation.
- Toast feedback for relevant actions.
- Empty, loading, and error states where applicable.
- Unknown-slug and not-found handling.

Use Angular services or focused state-management utilities for shared catalog and bookmark state.

Avoid direct DOM manipulation when Angular bindings can achieve the same result.

Do not create buttons that look interactive but do nothing.

## 12. Responsive Design

Support these viewport sizes:

- 360 × 800
- 390 × 844
- 430 × 932
- 600 × 960
- 820 × 1180
- 1024 × 768
- 1366 × 768
- 1440 × 900
- 1920 × 1080

Use responsive Tailwind utilities and fluid sizing where appropriate.

Requirements:
- No horizontal overflow.
- Mobile-friendly navigation.
- Responsive poster grid columns.
- Properly sized player and hero artwork.
- Readable policy and FAQ pages.
- Filters that wrap or collapse sensibly on mobile.
- Appropriate touch target sizes.
- Stable card proportions.
- Consistent gutters and content max-widths.

Do not simply shrink the desktop layout. Reconsider section arrangements where the mobile experience requires it.

## 13. Performance and Accessibility

Implement:
- Lazy loading for non-critical images.
- Sensible image dimensions and aspect ratios.
- Optimized local asset usage.
- Semantic headings and landmarks.
- Accessible button and input labels.
- Keyboard-accessible menus and dialogs.
- Visible focus indicators.
- Sufficient text contrast.
- Reduced-motion support where appropriate.
- Correct Angular track expressions for repeated collections.
- Appropriate route loading and not-found behavior.

Avoid unnecessary dependencies and large UI abstractions.

## 14. Implementation Workflow

Work in these stages:

### Stage 1 — Inspect and plan
Inspect the archive, inventory all pages, extract design tokens, identify reusable patterns, and map existing data to assets.

### Stage 2 — Project setup
Configure Angular, routing, Tailwind CSS, PrimeNG, PrimeIcons, typography, and global design tokens.

### Stage 3 — Shared foundation
Implement the header, footer, drama card, catalog service, metadata models, filter toolbar, and bookmark state.

### Stage 4 — Main discovery pages
Implement Home, Browse, Drama Details, Genres, Platforms, and Schedule.

### Stage 5 — Watch and utility pages
Implement Watch, Bookmarks, FAQ, Contact, DMCA, Privacy, and Terms.

### Stage 6 — Data population
Prepare local data fixtures, validate image mappings, normalize metadata, and provide consistent demo fallbacks.

### Stage 7 — Interaction testing
Verify navigation, search, filters, sorting, pagination, bookmarks, episode navigation, forms, and responsive menus.

### Stage 8 — Visual QA
Compare the Angular implementation against the original HTML prototype and improve visual discrepancies.

### Stage 9 — Final validation
Run the available Angular build and lint/test commands. Fix errors rather than merely reporting them.

## 15. Acceptance Criteria

The project is complete when:

1. The Angular application starts successfully.
2. All required routes render correctly.
3. The original DRA.CIN design identity is recognizable.
4. Tailwind CSS and PrimeNG are properly integrated.
5. The homepage and catalog are populated with meaningful data.
6. Drama cards display the correct mapped artwork.
7. Search, filters, sorting, and pagination work.
8. Bookmarks persist across refreshes.
9. Drama details and episode navigation work.
10. Schedule and FAQ interactions work.
11. Forms provide validation and clear feedback.
12. All legal-information pages are implemented.
13. Mobile and desktop layouts have been checked.
14. No major broken images, console errors, or build errors remain.
15. The project contains clear instructions for running locally.
16. Data provenance and demo metadata are clearly distinguished.
17. No backend or paid external service is required to run the prototype.

## Final Instructions

Prioritize a complete, coherent implementation over generating many superficial components.

Do not stop after setting up the Angular project, creating a homepage, or generating placeholder cards.

Inspect the existing design before changing it. Improve the UI where the existing implementation can be clearer, more responsive, or more usable, while preserving the brand.

Use real supplied assets where appropriate, and use legally reusable artwork or clearly identified local placeholders for missing assets.

Implement the actual files, run the application checks available in the environment, fix problems, and provide a concise summary of the implemented features, routes, data sources, and commands needed to run the project.

If a requirement cannot be completed because an external source or service is unavailable, explain the limitation and implement the best working local alternative.