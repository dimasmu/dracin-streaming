import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'browse',
    loadComponent: () =>
      import('./features/browse/browse.component').then((m) => m.BrowseComponent),
  },
  {
    path: 'drama/:slug',
    loadComponent: () =>
      import('./features/drama-detail/drama-detail.component').then((m) => m.DramaDetailComponent),
  },
  {
    path: 'watch/:slug/:episode',
    loadComponent: () => import('./features/watch/watch.component').then((m) => m.WatchComponent),
  },
  {
    path: 'genre',
    loadComponent: () =>
      import('./features/genres/genres.component').then((m) => m.GenresComponent),
  },
  {
    path: 'platform',
    loadComponent: () =>
      import('./features/platforms/platforms.component').then((m) => m.PlatformsComponent),
  },
  {
    path: 'release-schedule',
    loadComponent: () =>
      import('./features/schedule/schedule.component').then((m) => m.ScheduleComponent),
  },
  {
    path: 'bookmarks',
    loadComponent: () =>
      import('./features/bookmarks/bookmarks.component').then((m) => m.BookmarksComponent),
  },
  {
    path: 'faq',
    loadComponent: () => import('./features/faq/faq.component').then((m) => m.FaqComponent),
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./features/contact/contact.component').then((m) => m.ContactComponent),
  },
  {
    path: 'dmca',
    loadComponent: () => import('./features/dmca/dmca.component').then((m) => m.DmcaComponent),
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./features/privacy/privacy.component').then((m) => m.PrivacyComponent),
  },
  {
    path: 'terms',
    loadComponent: () => import('./features/terms/terms.component').then((m) => m.TermsComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
