import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DemoAccount } from '../../../core/models/auth.models';
import { HqAuthService } from '../../../core/services/hq-auth.service';
import { HqToastService } from '../../../shared/hq-toast.service';

@Component({
  selector: 'app-login-page',
  imports: [RouterLink],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly auth = inject(HqAuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(HqToastService);

  readonly email = signal('oda@workforce.hq');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly selectedDemoEmail = signal<string | null>(null);
  readonly demoAccounts = this.auth.demoAccounts;

  signInAs(account: DemoAccount): void {
    this.email.set(account.email);
    this.password.set(account.password);
    this.selectedDemoEmail.set(account.email);
    this.error.set('');
    this.auth.logout();
    this.completeLogin(account.email, account.password, account.role);
  }

  submit(event: Event): void {
    event.preventDefault();
    if (this.submitting()) return;

    this.error.set('');
    const email = this.email().trim();
    const password = this.password();

    if (!email || !password) {
      this.error.set('Enter your email and password.');
      return;
    }

    this.completeLogin(email, password);
  }

  private completeLogin(email: string, password: string, roleLabel?: string): void {
    this.submitting.set(true);
    const result = this.auth.login(email, password);
    this.submitting.set(false);

    if (!result.ok) {
      this.error.set(result.message);
      return;
    }

    const role = roleLabel ?? this.auth.currentUser()?.role ?? 'HQ';
    this.toast.success(`Signed in as ${role}.`, 'Welcome back');
    void this.router.navigate(['/dashboard']);
  }
}
