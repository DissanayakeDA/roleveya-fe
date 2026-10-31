import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/http';

@Component({
  selector: 'app-forgot-password',
  // FormsModule gives the plain <form> elements below NgForm, which is what emits (ngSubmit) and stops
  // the browser's own submit from reloading the page.
  imports: [FormsModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-forms.scss',
  template: `
    <h2>Reset your password</h2>
    @if (step() === 'request') {
      <p class="lead">Enter the email you signed up with and we'll send you a reset code.</p>
      <form (ngSubmit)="request()">
        @if (error()) {
          <p class="alert" role="alert">{{ error() }}</p>
        }
        <div class="field">
          <label for="email">Email</label>
          <input id="email" class="control" type="email" [formControl]="form.controls.email" autocomplete="email" required />
        </div>
        <button class="btn btn-primary btn-block" type="submit" [disabled]="busy()">
          {{ busy() ? 'Sending…' : 'Send reset code' }}
        </button>
      </form>
    } @else {
      <p class="lead">
        If an account exists for <strong>{{ form.controls.email.value }}</strong>, a code is on its way. Enter it with
        your new password.
      </p>
      <form (ngSubmit)="reset()">
        @if (error()) {
          <p class="alert" role="alert">{{ error() }}</p>
        }
        <div class="field">
          <label for="code">Reset code</label>
          <input
            id="code"
            class="control code"
            [formControl]="form.controls.code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="8"
          />
        </div>
        <div class="field">
          <label for="password">New password</label>
          <input
            id="password"
            class="control"
            type="password"
            [formControl]="form.controls.password"
            autocomplete="new-password"
          />
          <span class="hint">At least 8 characters, with upper and lower case letters, a number and a symbol.</span>
        </div>
        <button class="btn btn-primary btn-block" type="submit" [disabled]="busy()">
          {{ busy() ? 'Saving…' : 'Set new password' }}
        </button>
        <button type="button" class="link-btn" (click)="step.set('request')">Use a different email</button>
      </form>
    }
    <p class="switch">Remembered it? <a routerLink="/login">Back to sign in</a></p>
  `,
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: [inject(ActivatedRoute).snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
    code: ['', [Validators.required, Validators.pattern(/^\d{4,8}$/)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  protected readonly step = signal<'request' | 'reset'>('request');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected request(): void {
    if (this.form.controls.email.invalid) {
      this.error.set('Enter a valid email address.');
      return;
    }
    this.run(this.auth.forgotPassword(this.form.controls.email.value.trim()), () => this.step.set('reset'));
  }

  protected reset(): void {
    const { email, code, password } = this.form.getRawValue();
    if (this.form.controls.code.invalid || this.form.controls.password.invalid) {
      this.error.set('Enter the code from the email and a new password of at least 8 characters.');
      return;
    }
    this.run(this.auth.resetPassword(email.trim(), code.trim(), password), () =>
      this.router.navigate(['/login'], { queryParams: { email: email.trim(), reset: 1 } }),
    );
  }

  private run(request: ReturnType<AuthService['forgotPassword']>, done: () => void): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        done();
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
