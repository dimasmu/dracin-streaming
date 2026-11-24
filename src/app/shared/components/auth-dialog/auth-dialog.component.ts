import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '../../../core/services/auth.service';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-auth-dialog',
  imports: [FormsModule, DialogModule, InputTextModule, ButtonModule, TranslocoPipe],
  templateUrl: './auth-dialog.component.html',
})
export class AuthDialogComponent {
  protected readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  protected readonly i18n = inject(I18nService);

  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly totpCode = signal('');

  protected readonly dialogTitle = computed(() => {
    const mode = this.auth.authModalMode();
    if (mode === 'register') return this.i18n.t('auth.registerTitle');
    if (mode === '2fa') return this.i18n.t('auth.twoFactorTitle');
    return this.i18n.t('auth.loginTitle');
  });

  protected switchMode(mode: 'login' | 'register'): void {
    this.auth.authError.set(null);
    this.auth.authModalMode.set(mode);
  }

  protected async submitLogin(): Promise<void> {
    if (!this.email().trim() || !this.password()) return;
    const result = await this.auth.signInWithEmail(this.email(), this.password());
    if (result === 'ok') {
      this.password.set('');
      this.messages.add({
        severity: 'success',
        summary: this.i18n.t('auth.welcomeBack'),
        detail: this.auth.user()?.name ?? this.email(),
        life: 2500,
      });
    }
  }

  protected async submitRegister(): Promise<void> {
    if (!this.name().trim() || !this.email().trim() || this.password().length < 8) {
      this.auth.authError.set(this.i18n.t('auth.passwordMinHint'));
      return;
    }
    const ok = await this.auth.signUpWithEmail(this.name(), this.email(), this.password());
    if (ok) {
      this.password.set('');
      this.messages.add({
        severity: 'success',
        summary: this.i18n.t('auth.registerSuccess'),
        detail: this.auth.user()?.name ?? this.email(),
        life: 2600,
      });
    }
  }

  protected async submitTotp(): Promise<void> {
    if (!this.totpCode().trim()) return;
    const ok = await this.auth.verifyTwoFactorTotp(this.totpCode());
    if (ok) {
      this.totpCode.set('');
      this.password.set('');
      this.messages.add({
        severity: 'success',
        summary: this.i18n.t('auth.welcomeBack'),
        detail: this.auth.user()?.name ?? '',
        life: 2500,
      });
    }
  }
}
