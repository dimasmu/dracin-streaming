import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService } from '../services/auth.service';
import { I18nService } from '../services/i18n.service';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const messages = inject(MessageService);
  const i18n = inject(I18nService);

  await auth.ensureInitialized();

  // When backend is offline (standalone frontend preview), keep local CMS preview accessible.
  if (!auth.apiReachable()) {
    return true;
  }

  if (auth.canViewAdmin()) {
    return true;
  }

  const isId = i18n.lang() === 'id';
  if (!auth.isAuthenticated()) {
    messages.add({
      severity: 'warn',
      summary: isId ? 'Login Diperlukan' : 'Sign in required',
      detail: isId
        ? 'Silakan login dengan akun Admin atau Editor untuk membuka CMS.'
        : 'Please sign in with an Admin or Editor account to open the CMS.',
      life: 3200,
    });
    auth.openAuthModal('login');
  } else {
    messages.add({
      severity: 'error',
      summary: isId ? 'Akses Ditolak' : 'Access Denied',
      detail: isId
        ? 'Akun Anda tidak memiliki izin akses Admin CMS.'
        : 'Your account does not have permission to access the Admin CMS.',
      life: 3200,
    });
  }

  return router.createUrlTree(['/']);
};
