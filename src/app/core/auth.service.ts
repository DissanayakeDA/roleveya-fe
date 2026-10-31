import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, map, tap } from 'rxjs';

import { apiUrl } from './api-url';
import { Message, Session, SignUpResult, User } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly currentUser = signal<User | null>(null);
  private resolved = false;
  private pending: Promise<boolean> | null = null;

  readonly user = this.currentUser.asReadonly();
  readonly isSignedIn = computed(() => this.currentUser() !== null);
  readonly firstName = computed(() => this.currentUser()?.full_name?.trim().split(/\s+/)[0] ?? '');

  /** Resolves the session once per page load; guards await this before deciding. */
  ensureSession(): Promise<boolean> {
    if (this.resolved) {
      return Promise.resolve(this.isSignedIn());
    }
    this.pending ??= firstValueFrom(this.http.get<Session>(apiUrl('/auth/session')))
      .then((session) => this.setUser(session.user))
      .catch(() => this.setUser(null))
      .finally(() => (this.pending = null));
    return this.pending;
  }

  login(email: string, password: string): Observable<User | null> {
    return this.http.post<Session>(apiUrl('/auth/login'), { email, password }).pipe(
      map((session) => session.user),
      tap((user) => this.setUser(user)),
    );
  }

  signUp(body: { full_name: string; email: string; phone_number: string; password: string }) {
    return this.http.post<SignUpResult>(apiUrl('/auth/signup'), body);
  }

  confirm(email: string, code: string) {
    return this.http.post<Message>(apiUrl('/auth/confirm'), { email, code });
  }

  resendCode(email: string) {
    return this.http.post<Message>(apiUrl('/auth/resend-code'), { email });
  }

  forgotPassword(email: string) {
    return this.http.post<Message>(apiUrl('/auth/forgot-password'), { email });
  }

  resetPassword(email: string, code: string, newPassword: string) {
    return this.http.post<Message>(apiUrl('/auth/reset-password'), { email, code, new_password: newPassword });
  }

  logout(): Observable<void> {
    return this.http.post<void>(apiUrl('/auth/logout'), {}).pipe(tap({ finalize: () => this.markSignedOut() }));
  }

  markSignedOut(): void {
    this.setUser(null);
  }

  private setUser(user: User | null): boolean {
    this.currentUser.set(user);
    this.resolved = true;
    return user !== null;
  }
}
