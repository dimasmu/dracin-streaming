import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./layouts/admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dramas/new',
        data: { routeMode: 'new' },
        loadComponent: () =>
          import('./features/admin/admin-cms.component').then((m) => m.AdminCmsComponent),
      },
      {
        path: 'dramas/:slug/edit',
        data: { routeMode: 'edit' },
        loadComponent: () =>
          import('./features/admin/admin-cms.component').then((m) => m.AdminCmsComponent),
      },
      {
        path: ':tab',
        loadComponent: () =>
          import('./features/admin/admin-cms.component').then((m) => m.AdminCmsComponent),
      },
    ],
  },
  {
    path: '',
    loadComponent: () =>
      import('./layouts/public-layout/public-layout.component').then((m) => m.PublicLayoutComponent),
    children: [
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
        // Legacy detail URL: the watch page is now the canonical drama page.
        path: 'drama/:slug',
        pathMatch: 'full',
        redirectTo: (route) => `/watch/${route.params['slug']}/1`,
      },
      {
        // Bare /watch/:slug has no episode, default to the first one.
        path: 'watch/:slug',
        pathMatch: 'full',
        redirectTo: (route) => `/watch/${route.params['slug']}/1`,
      },
      {
        path: 'watch/:slug/:episode',
        loadComponent: () =>
          import('./features/watch/watch.component').then((m) => m.WatchComponent),
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
        loadComponent: () =>
          import('./features/terms/terms.component').then((m) => m.TermsComponent),
      },
      {
        path: '**',
        loadComponent: () =>
          import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
];
