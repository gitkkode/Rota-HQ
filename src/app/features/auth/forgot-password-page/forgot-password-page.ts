import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HqAuthService } from '../../../core/services/hq-auth.service';
import { HqToastService } from '../../../shared/hq-toast.service';

@Component({
  selector: 'app-forgot-password-page',
  imports: [RouterLink],
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.scss',
})
export class ForgotPasswordPage {
  private readonly auth = inject(HqAuthService);
  private readonly toast = inject(HqToastService);

  readonly email = signal('');
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly sent = signal(false);

  submit(event: Event): void {
    event.preventDefault();
    if (this.submitting() || this.sent()) return;

    this.error.set('');
    this.submitting.set(true);
    const result = this.auth.requestPasswordReset(this.email());
    this.submitting.set(false);

    if (!result.ok) {
      this.error.set(result.message);
      return;
    }

    this.sent.set(true);
    this.toast.info(
      'If an account exists, a reset link would be sent (mock only).',
      'Reset email sent',
    );
  }
}
