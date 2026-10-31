import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const signedInGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  if (await inject(AuthService).ensureSession()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: state.url !== '/' ? { next: state.url } : {} });
};

export const signedOutGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await inject(AuthService).ensureSession()) ? router.createUrlTree(['/dashboard']) : true;
};
