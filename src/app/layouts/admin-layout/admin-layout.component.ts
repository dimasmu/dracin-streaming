import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MessageService } from 'primeng/api';
import { CatalogService } from '../../core/services/catalog.service';
import { CmsRole, CmsService, ROLE_META } from '../../core/services/cms.service';
import { PreferencesService } from '../../core/services/preferences.service';

/** Base shell 2: Admin CMS (`/admin`) with persistent left sidebar, 3-role RBAC switcher, and adminGuard screen. */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, NgOptimizedImage],
  templateUrl: './admin-layout.component.html',
  host: {
    '(document:keydown.escape)': 'cms.setMobileSidebarOpen(false)',
  },
})
export class AdminLayoutComponent {
  protected readonly cms = inject(CmsService);
  protected readonly catalog = inject(CatalogService);
  protected readonly prefs = inject(PreferencesService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  protected readonly roleOptions: readonly { id: CmsRole; label: string }[] = [
    { id: 'admin', label: 'Admin' },
    { id: 'editor', label: 'Editor' },
    { id: 'user', label: 'User' },
  ];

  protected readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly routeBadge = computed(() => {
    if (this.cms.role() === 'user') return 'tiraiplay.app/admin (403 Blocked)';
    return `tiraiplay.app${this.currentUrl()}`;
  });

  protected readonly pendingRequestsCount = computed(
    () => this.cms.requests().filter((r) => r.status !== 'Tersedia').length,
  );

  protected readonly currentMeta = computed(() => ROLE_META[this.cms.role()]);

  protected isActive(route: string): boolean {
    const url = this.currentUrl();
    if (route === '/admin/dramas/new') {
      return url.startsWith('/admin/dramas/new') || url.endsWith('/edit');
    }
    if (route === '/admin/dramas') {
      return url === '/admin/dramas';
    }
    return url === route || url.startsWith(`${route}/`);
  }

  protected switchRole(role: CmsRole): void {
    this.cms.setRole(role);
    this.messages.add({
      severity: 'info',
      summary: 'Simulasi RBAC',
      detail: `Berpindah ke role ${ROLE_META[role].label}`,
      life: 2400,
    });
  }

  protected onGlobalSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.cms.searchQuery.set(value);
    if (value.trim() && this.currentUrl() !== '/admin/dramas') {
      void this.router.navigate(['/admin/dramas']);
    }
  }

  protected openCreateNew(): void {
    this.cms.editorPrefill.set(null);
    this.cms.setMobileSidebarOpen(false);
    void this.router.navigate(['/admin/dramas/new']);
  }
}
