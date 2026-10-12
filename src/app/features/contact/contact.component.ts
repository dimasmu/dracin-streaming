import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';

@Component({
  imports: [RouterLink, ReactiveFormsModule, InputTextModule, SelectModule],
  templateUrl: './contact.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactComponent {
  private readonly fb = inject(FormBuilder);
  private readonly messages = inject(MessageService);

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly sending = signal(false);

  protected readonly categoryOptions = [
    { label: 'Metadata Report', value: 'metadata' },
    { label: 'Bug / Technical Report', value: 'bug' },
    { label: 'Content Request', value: 'request' },
    { label: 'Copyright (DMCA)', value: 'copyright' },
    { label: 'Feedback / Suggestion', value: 'feedback' },
    { label: 'Other', value: 'other' },
  ];

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
        summary: 'Check the form',
        detail: 'Please fix the highlighted fields.',
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
        summary: 'Message recorded',
        detail: 'This is a local simulation; nothing was sent to a server.',
        life: 4000,
      });
    }, 900);
  }

  protected reset(): void {
    this.form.reset();
    this.submitted.set(false);
  }
}
