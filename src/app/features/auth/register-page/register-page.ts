import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HqAuthService } from '../../../core/services/hq-auth.service';
import { HqToastService } from '../../../shared/hq-toast.service';

@Component({
  selector: 'app-register-page',
  imports: [RouterLink],
  templateUrl: './register-page.html',
  styleUrl: './register-page.scss',
})
export class RegisterPage {
  private readonly auth = inject(HqAuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(HqToastService);

  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly submitting = signal(false);
  readonly error = signal('');

  readonly passwordsMatch = computed(() => {
    const confirm = this.confirmPassword();
    if (!confirm) return true;
    return this.password() === confirm;
  });

  submit(event: Event): void {
    event.preventDefault();
    if (this.submitting()) return;

    this.error.set('');

    if (!this.passwordsMatch()) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.submitting.set(true);
    const result = this.auth.register(this.name(), this.email(), this.password());
    this.submitting.set(false);

    if (!result.ok) {
      this.error.set(result.message);
      return;
    }

    this.toast.success('Your account is ready. Welcome to Workforce HQ.', 'Account created');
    void this.router.navigate(['/dashboard']);
  }
}
