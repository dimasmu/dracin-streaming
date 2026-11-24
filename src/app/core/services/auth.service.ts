import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_ROLE_PERMISSIONS,
  type CmsPermission,
  type CmsRole,
  type CmsRolePermissions,
  type QuotaInfo,
} from '@tiraiplay/shared';
import { BookmarkService } from './bookmark.service';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  username: string;
  role: CmsRole;
  status: string;
  department: string;
  twoFactorEnabled: boolean;
}

export interface ActiveSubscription {
  planId: string;
  expiresAt: string;
}

export interface MeResponse {
  user: AuthUser | null;
  permissions: CmsRolePermissions;
  subscription: ActiveSubscription | null;
  quota: QuotaInfo;
}

export type AuthModalMode = 'login' | 'register' | '2fa';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly bookmarks = inject(BookmarkService);

  private initPromise: Promise<void> | null = null;

  readonly initialized = signal(false);
  readonly apiReachable = signal(true);
  readonly loading = signal(false);
  readonly user = signal<AuthUser | null>(null);
  readonly permissions = signal<CmsRolePermissions>(
    structuredClone(DEFAULT_ROLE_PERMISSIONS.user),
  );
  readonly subscription = signal<ActiveSubscription | null>(null);
  readonly quota = signal<QuotaInfo | null>(null);

  readonly authModalOpen = signal(false);
  readonly authModalMode = signal<AuthModalMode>('login');
  readonly authError = signal<string | null>(null);

  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isVip = computed(() => Boolean(this.subscription() || this.quota()?.unlimited));
  readonly canViewAdmin = computed(() => {
    if (!this.apiReachable()) return true;
    return this.permissions().viewAdmin;
  });

  readonly quotaBadgeText = computed(() => {
    const q = this.quota();
    if (!q) return '';
    if (q.unlimited) return 'VIP Unlimited';
    const remaining = q.remainingToday ?? Math.max(0, (q.dailyLimit ?? 0) - q.usedToday);
    return `${remaining}/${q.dailyLimit ?? 10} Ep`;
  });

  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.refreshSession().finally(() => {
        this.initialized.set(true);
      });
    }
    return this.initPromise;
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized()) return;
    await this.init();
  }

  can(perm: CmsPermission): boolean {
    if (!this.apiReachable()) return true;
    return this.permissions()[perm];
  }

  openAuthModal(mode: AuthModalMode = 'login'): void {
    this.authError.set(null);
    this.authModalMode.set(mode);
    this.authModalOpen.set(true);
  }

  closeAuthModal(): void {
    this.authModalOpen.set(false);
    this.authError.set(null);
  }

  async refreshSession(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<MeResponse>('/api/me'));
      this.apiReachable.set(true);
      this.user.set(res.user);
      this.permissions.set(res.permissions);
      this.subscription.set(res.subscription);
      this.quota.set(res.quota);
      this.bookmarks.setAuthenticated(Boolean(res.user));
    } catch {
      // Graceful fallback when running standalone frontend without backend server
      this.apiReachable.set(false);
      this.user.set(null);
      this.permissions.set(structuredClone(DEFAULT_ROLE_PERMISSIONS.user));
      this.subscription.set(null);
      this.quota.set(null);
      this.bookmarks.setAuthenticated(false);
    }
  }

  async signInWithEmail(email: string, password: string): Promise<'ok' | '2fa' | 'error'> {
    this.loading.set(true);
    this.authError.set(null);
    try {
      const res = await firstValueFrom(
        this.http.post<{ twoFactorRedirect?: boolean }>('/api/auth/sign-in/email', {
          email: email.trim(),
          password,
        }),
      );
      if (res?.twoFactorRedirect) {
        this.authModalMode.set('2fa');
        return '2fa';
      }
      await this.afterAuthenticated();
      return 'ok';
    } catch (err) {
      this.authError.set(this.extractErrorMessage(err, 'Email atau kata sandi tidak valid.'));
      return 'error';
    } finally {
      this.loading.set(false);
    }
  }

  async signUpWithEmail(name: string, email: string, password: string): Promise<boolean> {
    this.loading.set(true);
    this.authError.set(null);
    try {
      await firstValueFrom(
        this.http.post('/api/auth/sign-up/email', {
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      );
      await this.afterAuthenticated();
      return true;
    } catch (err) {
      this.authError.set(this.extractErrorMessage(err, 'Pendaftaran gagal. Cek kembali data Anda.'));
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async verifyTwoFactorTotp(code: string): Promise<boolean> {
    this.loading.set(true);
    this.authError.set(null);
    try {
      await firstValueFrom(
        this.http.post('/api/auth/two-factor/verify-totp', {
          code: code.trim(),
        }),
      );
      await this.afterAuthenticated();
      return true;
    } catch (err) {
      this.authError.set(this.extractErrorMessage(err, 'Kode OTP 2FA salah atau kadaluarsa.'));
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  signInWithGoogle(): void {
    const callbackURL = window.location.href;
    void firstValueFrom(
      this.http.post<{ url?: string }>('/api/auth/sign-in/social', {
        provider: 'google',
        callbackURL,
      }),
    )
      .then((res) => {
        if (res?.url) {
          window.location.href = res.url;
        }
      })
      .catch((err) => {
        this.authError.set(
          this.extractErrorMessage(err, 'Google OAuth belum dikonfigurasi di server.'),
        );
      });
  }

  async signOut(): Promise<void> {
    this.loading.set(true);
    try {
      await firstValueFrom(this.http.post('/api/auth/sign-out', {}));
    } catch {
      /* ignore network errors on sign-out */
    } finally {
      this.loading.set(false);
      await this.refreshSession();
    }
  }

  updateQuota(next: QuotaInfo): void {
    this.quota.set(next);
  }

  private async afterAuthenticated(): Promise<void> {
    await this.refreshSession();
    await this.syncLocalBookmarks();
    this.closeAuthModal();
  }

  private async syncLocalBookmarks(): Promise<void> {
    if (!this.apiReachable() || !this.user()) return;
    let localSlugs: string[] = [];
    try {
      const raw = localStorage.getItem('dracin-bookmarks');
      const parsed = raw ? (JSON.parse(raw) as Array<{ dramaId?: string }>) : [];
      localSlugs = Array.isArray(parsed)
        ? parsed.map((b) => b.dramaId).filter((v): v is string => Boolean(v))
        : [];
    } catch {
      localSlugs = [];
    }
    if (!localSlugs.length) return;
    try {
      await firstValueFrom(
        this.http.post('/api/bookmarks/sync', { dramaIdsOrSlugs: localSlugs }),
      );
      await this.bookmarks.loadFromApi();
    } catch {
      /* ignore sync failure */
    }
  }

  private extractErrorMessage(err: unknown, fallback: string): string {
    if (err && typeof err === 'object') {
      const e = err as { error?: { message?: string }; status?: number };
      if (e.status === 0) {
        return 'Server backend tidak terjangkau (pastikan API berjalan di port 3000).';
      }
      if (e.error?.message) return e.error.message;
    }
    return fallback;
  }
}
