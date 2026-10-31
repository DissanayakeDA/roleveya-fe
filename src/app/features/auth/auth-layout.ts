import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth">
      <section class="sign" aria-label="About Roleveya">
        <p class="brand">Roleveya</p>
        <div class="pitch">
          <h1>Know where every application stands.</h1>
          <p>Save roles you like, log where you've applied, and watch each one move from first look to offer.</p>
        </div>
        <ol class="route" aria-hidden="true">
          <li class="done"><span></span>Saved</li>
          <li class="done"><span></span>Applied</li>
          <li class="here"><span></span>Interviewing</li>
          <li><span></span>Offer</li>
        </ol>
      </section>
      <main class="form-side">
        <div class="form-wrap">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styleUrl: './auth-layout.scss',
})
export class AuthLayout {}
