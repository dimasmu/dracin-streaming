import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { TranslocoPipe } from '@jsverse/transloco';
import { I18nService } from '../../core/services/i18n.service';

@Component({
  imports: [RouterLink, ReactiveFormsModule, InputTextModule, SelectModule, TranslocoPipe],
  templateUrl: './contact.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactComponent {
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);
  private readonly i18n = inject(I18nService);

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly sending = signal(false);

  private readonly categoryValues = ['metadata', 'bug', 'request', 'copyright', 'feedback', 'other'];
  protected readonly categoryOptions = computed(() =>
    this.categoryValues.map((value) => ({ label: this.i18n.t('contact.cat.' + value), value })),
  );

  protected readonly form = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    subject: ['', [Validators.required]],
    category: ['', [Validators.required]],
    message: [''],
  });

  protected isInvalid(field: 'name' | 'email' | 'subject' | 'category'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messages.add({
        severity: 'error',
        summary: this.i18n.t('contact.checkForm'),
        detail: this.i18n.t('contact.fixFields'),
        life: 3000,
      });
      return;
    }
    this.sending.set(true);
    setTimeout(() => {
      this.sending.set(false);
      this.submitted.set(true);
      this.messages.add({
        severity: 'success',
        summary: this.i18n.t('contact.recorded'),
        detail: this.i18n.t('contact.localSim'),
        life: 4000,
      });
    }, 900);
  }

  protected reset(): void {
    this.form.reset();
    this.submitted.set(false);
  }
}
