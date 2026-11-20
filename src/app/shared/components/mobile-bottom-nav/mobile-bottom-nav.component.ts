import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map } from 'rxjs';

@Component({
  selector: 'app-mobile-bottom-nav',
  imports: [RouterLink, TranslocoPipe],
  template: `
    <nav class="mobile-bottom-nav" [attr.aria-label]="'nav.mobile' | transloco">
      <a
        routerLink="/"
        class="mobile-bottom-item"
        [class.is-active]="isActive('/')"
        [attr.aria-current]="isActive('/') ? 'page' : null"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
          <polyline points="9 21 9 14 15 14 15 21" />
        </svg>
        <span>{{ 'nav.home' | transloco }}</span>
      </a>

      <a
        routerLink="/browse"
        class="mobile-bottom-item"
        [class.is-active]="isActive('/browse')"
        [attr.aria-current]="isActive('/browse') ? 'page' : null"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span>{{ 'nav.browse' | transloco }}</span>
      </a>

      <a
        routerLink="/genre"
        class="mobile-bottom-item"
        [class.is-active]="isActive('/genre')"
        [attr.aria-current]="isActive('/genre') ? 'page' : null"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <span>{{ 'nav.genre' | transloco }}</span>
      </a>

      <a
        routerLink="/release-schedule"
        class="mobile-bottom-item"
        [class.is-active]="isActive('/release-schedule')"
        [attr.aria-current]="isActive('/release-schedule') ? 'page' : null"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <span>{{ 'nav.schedule' | transloco }}</span>
      </a>

      <a
        routerLink="/bookmarks"
        class="mobile-bottom-item"
        [class.is-active]="isActive('/bookmarks')"
        [attr.aria-current]="isActive('/bookmarks') ? 'page' : null"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V21l-6-3.5L6 21z" />
        </svg>
        <span>{{ 'nav.bookmarks' | transloco }}</span>
      </a>
    </nav>
  `,
})
export class MobileBottomNavComponent {
  private readonly router = inject(Router);

  protected readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected isActive(path: string): boolean {
    const url = this.currentUrl().split('?')[0];
    if (path === '/') return url === '/';
    return url === path || url.startsWith(`${path}/`);
  }
}
