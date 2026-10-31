import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/http';
import { VerifyEmail } from './verify-email';

/** Mirrors Cognito's default password policy so most problems are caught before submitting. */
const PASSWORD_RULES = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink, VerifyEmail],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-forms.scss',
  template: `
    @if (step() === 'verify') {
      <app-verify-email [email]="form.controls.email.value" (verified)="signIn()" />
    } @else {
      <h2>Create your account</h2>
      <p class="lead">It takes a minute. You'll confirm your email with a code.</p>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error()) {
          <p class="alert" role="alert">{{ error() }}</p>
        }
        <div class="field">
          <label for="full_name">Full name</label>
          <input id="full_name" class="control" formControlName="full_name" autocomplete="name" required />
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" class="control" type="email" formControlName="email" autocomplete="email" required />
          @if (form.controls.email.touched && form.controls.email.invalid) {
            <span class="error-text">Enter a valid email address.</span>
          }
        </div>
        <div class="field">
          <label for="phone">Phone number</label>
          <input
            id="phone"
            class="control"
            type="tel"
            formControlName="phone_number"
            autocomplete="tel"
            placeholder="+94 77 123 4567"
            aria-describedby="phone-hint"
            required
          />
          @if (form.controls.phone_number.touched && form.controls.phone_number.invalid) {
            <span class="error-text">Start with + and your country code, e.g. +94 77 123 4567.</span>
          } @else {
            <span class="hint" id="phone-hint">Include your country code.</span>
          }
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            class="control"
            type="password"
            formControlName="password"
            autocomplete="new-password"
            aria-describedby="password-hint"
            required
          />
          <span class="hint" id="password-hint" [class.error-text]="form.controls.password.touched && form.controls.password.invalid">
            At least 8 characters, with upper and lower case letters, a number and a symbol.
          </span>
        </div>
        <button class="btn btn-primary btn-block" type="submit" [disabled]="busy()">
          {{ busy() ? 'Creating account…' : 'Create account' }}
        </button>
      </form>
      <p class="switch">Already have an account? <a routerLink="/login">Sign in</a></p>
    }
  `,
})
export class Signup {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = inject(NonNullableFormBuilder).group({
    full_name: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email]],
    phone_number: ['', [Validators.required, Validators.pattern(/^\+[1-9][\d\s-]{6,18}$/)]],
    password: ['', [Validators.required, Validators.pattern(PASSWORD_RULES)]],
  });
  protected readonly step = signal<'details' | 'verify'>('details');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Check the highlighted fields.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const value = this.form.getRawValue();
    this.auth
      .signUp({ ...value, email: value.email.trim(), phone_number: value.phone_number.replace(/[\s-]/g, '') })
      .subscribe({
        next: (result) => {
          this.busy.set(false);
          if (result.requires_confirmation) {
            this.step.set('verify');
          } else {
            this.signIn();
          }
        },
        error: (err) => {
          this.busy.set(false);
          this.error.set(errorMessage(err));
        },
      });
  }

  /** The password is still in this form, so the new user goes straight in after verifying. */
  protected signIn(): void {
    const { email, password } = this.form.getRawValue();
    this.auth.login(email.trim(), password).subscribe({
      next: () => {
        this.form.reset();
        this.router.navigateByUrl('/dashboard');
      },
      error: () => this.router.navigate(['/login'], { queryParams: { email: email.trim() } }),
    });
  }
}
