import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { errorCode, errorMessage } from '../../core/http';
import { VerifyEmail } from './verify-email';

/** Only same-app paths are followed after sign-in, never another site. */
export function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard';
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, VerifyEmail],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-forms.scss',
  template: `
    @if (needsVerification()) {
      <app-verify-email [email]="form.controls.email.value" (verified)="submit()" />
    } @else {
      <h2>Sign in</h2>
      <p class="lead">Pick up where you left off.</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        @if (notice()) {
          <p class="alert info" role="status">{{ notice() }}</p>
        }
        @if (error()) {
          <p class="alert" role="alert">{{ error() }}</p>
        }
        <div class="field">
          <label for="email">Email</label>
          <input id="email" class="control" type="email" formControlName="email" autocomplete="email" required />
        </div>
        <div class="field">
          <div class="row-between">
            <label for="password" class="label">Password</label>
            <a routerLink="/forgot-password" [queryParams]="{ email: form.controls.email.value || null }">Forgot password?</a>
          </div>
          <input
            id="password"
            class="control"
            type="password"
            formControlName="password"
            autocomplete="current-password"
            required
          />
        </div>
        <button class="btn btn-primary btn-block" type="submit" [disabled]="busy()">
          {{ busy() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
      <p class="switch">New to Roleveya? <a routerLink="/signup">Create an account</a></p>
    }
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(
    this.route.snapshot.queryParamMap.get('reset') ? 'Password updated. Sign in with your new password.' : null,
  );
  protected readonly needsVerification = signal(false);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Enter your email and password.');
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl(safeNext(this.route.snapshot.queryParamMap.get('next'))),
      error: (err) => {
        this.busy.set(false);
        if (errorCode(err) === 'user_not_confirmed') {
          // No automatic resend: a new code replaces the one already in the user's inbox, so every sign-in
          // attempt would invalidate the code they're about to type. "Send a new one" is on the next screen.
          this.needsVerification.set(true);
          return;
        }
        this.needsVerification.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
