import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../core/auth.service';
import { errorCode, errorMessage } from '../../core/http';

/** Second step of sign-up: enter the code Cognito emailed. */
@Component({
  selector: 'app-verify-email',
  // FormsModule gives the plain <form> below NgForm, which is what emits (ngSubmit) and stops the
  // browser's own submit from reloading the page.
  imports: [FormsModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './auth-forms.scss',
  template: `
    <h2>Check your email</h2>
    <p class="lead">
      Enter the code we emailed to <strong>{{ email() }}</strong> to finish setting up your account. If you have
      more than one, use the newest.
    </p>
    <form (ngSubmit)="submit()">
      @if (error()) {
        <p class="alert" role="alert">{{ error() }}</p>
      }
      @if (info()) {
        <p class="alert info" role="status">{{ info() }}</p>
      }
      <div class="field">
        <label for="code">Verification code</label>
        <input
          id="code"
          class="control code"
          [formControl]="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="8"
          required
        />
      </div>
      <button class="btn btn-primary btn-block" type="submit" [disabled]="busy()">
        {{ busy() ? 'Verifying…' : 'Verify email' }}
      </button>
      <p class="muted">
        No code?
        <button type="button" class="link-btn" (click)="resend()" [disabled]="resending()">Send a new one</button>
      </p>
    </form>
  `,
})
export class VerifyEmail {
  private readonly auth = inject(AuthService);
  readonly email = input.required<string>();
  readonly verified = output<void>();

  protected readonly code = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{4,8}$/)],
  });
  protected readonly busy = signal(false);
  protected readonly resending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly info = signal<string | null>(null);

  protected submit(): void {
    if (this.code.invalid) {
      this.error.set('Enter the code from the email, digits only.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.auth.confirm(this.email(), this.code.value.trim()).subscribe({
      next: () => this.verified.emit(),
      error: (err) => {
        this.busy.set(false);
        if (errorCode(err) === 'already_confirmed') {
          this.verified.emit();
          return;
        }
        this.error.set(errorMessage(err));
      },
    });
  }

  protected resend(): void {
    this.resending.set(true);
    this.auth.resendCode(this.email()).subscribe({
      next: (res) => {
        this.resending.set(false);
        this.info.set(res.message);
      },
      error: (err) => {
        this.resending.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
