import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { ErrorHandler, Injectable, inject, isDevMode } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { API_BASE, apiUrl } from './api-url';
import { AuthService } from './auth.service';

/**
 * Applies to every call made under the configured API base (environment.apiBaseUrl). With the default
 * relative "/api", the dev server (proxy.conf.mjs) or web server (nginx.conf.template) forwards the call,
 * so the backend's real address never reaches the browser. Auth lives in HttpOnly cookies that scripts
 * can't read.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE)) {
    return next(req);
  }
  const auth = inject(AuthService);
  const router = inject(Router);
  const request = req.clone({
    // Marks the request as coming from this app; the API rejects state-changing requests without it (CSRF).
    setHeaders: { 'X-Requested-With': 'roleveya' },
    // Sends the auth cookies if apiBaseUrl points at another origin; a no-op for the relative default.
    withCredentials: true,
  });

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !req.url.startsWith(apiUrl('/auth/'))) {
        auth.markSignedOut();
        router.navigate(['/login'], { queryParams: { next: router.url }, replaceUrl: true });
      }
      return throwError(() => error);
    }),
  );
};

/** Turns an API failure into a sentence for the UI, without leaking request details. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return "Can't reach Roleveya right now. Check your connection and try again.";
    }
    const detail = error.error?.detail;
    if (typeof detail === 'string' && detail) {
      return detail;
    }
  }
  return fallback;
}

export function errorCode(error: unknown): string | null {
  return error instanceof HttpErrorResponse && typeof error.error?.code === 'string' ? error.error.code : null;
}

/**
 * Angular's default handler prints errors, including failed request URLs, to the console. In production
 * nothing is printed; in development everything except HTTP failures is, so bugs stay visible.
 */
@Injectable()
export class QuietErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    if (isDevMode() && !(error instanceof HttpErrorResponse)) {
      console.error(error);
    }
  }
}
