import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { filter, map } from 'rxjs';
import { CatalogService } from '../../core/services/catalog.service';
import { AuthService } from '../../core/services/auth.service';
import {
  CMS_PERMISSION_META,
  CmsRole,
  CmsService,
  ROLE_META,
} from '../../core/services/cms.service';
import { PreferencesService } from '../../core/services/preferences.service';

interface SearchableMenuEntry {
  id: string;
  label: string;
  route: string;
  icon: string;
  group: string;
  keywords: string;
}

interface AdminNotificationItem {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  icon: string;
  tone: 'accent' | 'gold' | 'rose' | 'cyan';
  time: string;
}

const MENU_KEYWORD_MAP: Record<string, string> = {
  dashboard: 'beranda ringkasan overview kpi aktivitas',
  analytics: 'statistik grafik performa penonton views rating',
  dramas: 'katalog judul film serial poster carousel slug metadata',
  episodes: 'episode video stream subtitle sub dubbing',
  schedule: 'jadwal rilis tayang kalender mingguan hari jam',
  taxonomy: 'platform genre tag kategori sumber ott',
  moderation: 'moderasi request permintaan penonton komentar ulasan dmca laporan',
  users: 'pengguna akun user tim role hak akses rbac permission',
  settings: 'pengaturan konfigurasi sistem json ekspor cdn maintenance',
};

/** Production Admin CMS shell (`/admin`) with compact 4-item topbar (hamburger, menu search, notifications, profile). */
@Component({
  selector: 'app-admin-layout',
  imports: [
    RouterOutlet,
    RouterLink,
    NgOptimizedImage,
    FormsModule,
    InputTextModule,
    ButtonModule,
    DialogModule,
    SelectModule,
    TagModule,
  ],
  templateUrl: './admin-layout.component.html',
  host: {
    '(document:keydown.escape)': 'closeTransientUi()',
    '(document:click)': 'closeTopbarOverlays()',
    '(window:scroll)': 'closeTopbarOverlays()',
  },
})
export class AdminLayoutComponent {
  protected readonly cms = inject(CmsService);
  protected readonly auth = inject(AuthService);
  protected readonly catalog = inject(CatalogService);
  protected readonly prefs = inject(PreferencesService);
  private readonly router = inject(Router);

  protected readonly roleDialogOpen = signal(false);
  protected readonly menuSearchQuery = signal('');
  protected readonly menuSearchOpen = signal(false);
  protected readonly notifOpen = signal(false);
  protected readonly notificationsRead = signal(false);
  protected readonly permissionMeta = CMS_PERMISSION_META;

  protected readonly searchableMenus: SearchableMenuEntry[] = [
    ...this.cms.navGroups.flatMap((group) =>
      group.items.map((item) => ({
        id: item.id,
        label: item.label,
        route: item.route,
        icon: item.icon,
        group: group.label,
        keywords: `${item.label} ${group.label} ${item.route} ${MENU_KEYWORD_MAP[item.id] ?? ''}`.toLowerCase(),
      })),
    ),
    {
      id: 'new-drama',
      label: 'Tambah Drama Baru',
      route: '/admin/dramas/new',
      icon: 'pi pi-plus-circle',
      group: 'Aksi Cepat',
      keywords: 'tambah drama baru create upload poster carousel metadata',
    },
    {
      id: 'public-site',
      label: 'Lihat Website Utama',
      route: '/',
      icon: 'pi pi-external-link',
      group: 'Website Publik',
      keywords: 'website utama publik beranda depan streaming tonton',
    },
  ];

  protected readonly filteredMenus = computed(() => {
    const q = this.menuSearchQuery().trim().toLowerCase();
    if (!q) return this.searchableMenus;
    return this.searchableMenus.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        item.keywords.includes(q),
    );
  });

  protected readonly roleSelectOptions: { label: string; value: CmsRole }[] = [
    { label: 'Role: Admin', value: 'admin' },
    { label: 'Role: Editor', value: 'editor' },
    { label: 'Role: User', value: 'user' },
  ];

  protected readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly pendingRequestsCount = computed(
    () => this.cms.requests().filter((r) => r.status !== 'Tersedia' && r.status !== 'Ditolak').length,
  );

  protected readonly pendingCommentsCount = computed(
    () => this.cms.comments().filter((c) => c.status === 'Ditinjau').length,
  );

  protected readonly pendingDmcaCount = computed(
    () => this.cms.dmcaTickets().filter((t) => t.status === 'Terbuka' || t.status === 'Diproses').length,
  );

  protected readonly pendingUsersCount = computed(
    () => this.cms.users().filter((u) => u.status === 'Menunggu Verifikasi').length,
  );

  protected readonly pendingModerationTotal = computed(
    () =>
      this.pendingRequestsCount() +
      this.pendingCommentsCount() +
      this.pendingDmcaCount() +
      this.pendingUsersCount(),
  );

  protected readonly unreadNotificationCount = computed(() =>
    this.notificationsRead() ? 0 : this.pendingModerationTotal(),
  );

  protected readonly notificationItems = computed<AdminNotificationItem[]>(() => {
    const items: AdminNotificationItem[] = [];
    if (this.pendingRequestsCount() > 0) {
      items.push({
        id: 'notif-req',
        title: `${this.pendingRequestsCount()} Request Drama Menunggu`,
        subtitle: 'Tinjau permintaan penonton dan konversi ke katalog.',
        route: '/admin/moderation',
        icon: 'pi pi-inbox',
        tone: 'gold',
        time: 'Antrean',
      });
    }
    if (this.pendingCommentsCount() > 0) {
      items.push({
        id: 'notif-comment',
        title: `${this.pendingCommentsCount()} Komentar Perlu Review`,
        subtitle: 'Cek laporan spoiler, spam, atau balas komentar episode.',
        route: '/admin/moderation',
        icon: 'pi pi-comments',
        tone: 'cyan',
        time: 'Moderasi',
      });
    }
    if (this.pendingDmcaCount() > 0) {
      items.push({
        id: 'notif-dmca',
        title: `${this.pendingDmcaCount()} Tiket DMCA & Koreksi Terbuka`,
        subtitle: 'Segera tindak lanjuti tiket kepatuhan & metadata.',
        route: '/admin/moderation',
        icon: 'pi pi-shield',
        tone: 'rose',
        time: 'Prioritas',
      });
    }
    if (this.pendingUsersCount() > 0) {
      items.push({
        id: 'notif-users',
        title: `${this.pendingUsersCount()} Akun Menunggu Verifikasi`,
        subtitle: 'Kelola status pengguna dan hak akses role di panel User.',
        route: '/admin/users',
        icon: 'pi pi-user-edit',
        tone: 'accent',
        time: 'Akun',
      });
    }
    for (const [idx, entry] of this.cms.activityLog().slice(0, 3).entries()) {
      items.push({
        id: `notif-act-${idx}`,
        title: entry.actor,
        subtitle: entry.action,
        route: '/admin/dashboard',
        icon: 'pi pi-history',
        tone: 'accent',
        time: entry.time,
      });
    }
    return items;
  });

  protected readonly currentMeta = computed(() => {
    const authUser = this.auth.user();
    if (authUser) {
      const roleMeta = ROLE_META[authUser.role] ?? ROLE_META.user;
      return {
        ...roleMeta,
        name: authUser.name,
        email: authUser.email,
      };
    }
    return ROLE_META[this.cms.role()];
  });
  protected readonly activePermissions = computed(() =>
    this.auth.isAuthenticated()
      ? this.auth.permissions()
      : this.cms.rolePermissions()[this.cms.role()],
  );

  protected async signOutFromAdmin(): Promise<void> {
    this.roleDialogOpen.set(false);
    await this.auth.signOut();
    void this.router.navigateByUrl('/');
  }

  protected isActive(route: string): boolean {
    const url = this.currentUrl();
    if (route === '/admin/dramas') {
      return url === '/admin/dramas' || url.startsWith('/admin/dramas/');
    }
    return url === route || url.startsWith(`${route}/`);
  }

  protected onRoleSwitch(role: CmsRole | null): void {
    if (!role) return;
    this.cms.setRole(role);
    this.cms.logActivity(`Simulasi role dialihkan ke ${ROLE_META[role].label}`);
  }

  protected closeTopbarOverlays(): void {
    this.menuSearchOpen.set(false);
    this.notifOpen.set(false);
  }

  protected closeTransientUi(): void {
    this.cms.setMobileSidebarOpen(false);
    this.roleDialogOpen.set(false);
    this.closeTopbarOverlays();
  }

  protected onMenuSearchInput(value: string): void {
    this.menuSearchQuery.set(value);
    this.menuSearchOpen.set(true);
    this.notifOpen.set(false);
  }

  protected onMenuSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.menuSearchOpen.set(false);
      return;
    }
    if (event.key === 'Enter') {
      const first = this.filteredMenus()[0];
      if (first) {
        event.preventDefault();
        this.selectMenuFromSearch(first.route);
      }
    }
  }

  protected selectMenuFromSearch(route: string): void {
    this.menuSearchQuery.set('');
    this.menuSearchOpen.set(false);
    this.cms.setMobileSidebarOpen(false);
    if (route === '/admin/dramas/new') {
      this.cms.editorPrefill.set(null);
    }
    void this.router.navigateByUrl(route);
  }

  protected toggleNotifications(event: Event): void {
    event.stopPropagation();
    this.menuSearchOpen.set(false);
    this.notifOpen.update((v) => !v);
  }

  protected markAllNotificationsRead(): void {
    this.notificationsRead.set(true);
  }

  protected openNotificationTarget(route: string): void {
    this.notifOpen.set(false);
    this.cms.setMobileSidebarOpen(false);
    void this.router.navigateByUrl(route);
  }
}
