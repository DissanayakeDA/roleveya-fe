import { Routes } from '@angular/router';

import { signedInGuard, signedOutGuard, unsavedChangesGuard } from './core/guards';

export const routes: Routes = [
  // Without this, "/" matches the auth layout below with no form in it. Signed-in visitors are sent on to
  // the dashboard by signedOutGuard.
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: '',
    loadComponent: () => import('./features/auth/auth-layout').then((m) => m.AuthLayout),
    canActivate: [signedOutGuard],
    children: [
      { path: 'login', title: 'Sign in | Roleveya', loadComponent: () => import('./features/auth/login').then((m) => m.Login) },
      {
        path: 'signup',
        title: 'Create account | Roleveya',
        loadComponent: () => import('./features/auth/signup').then((m) => m.Signup),
      },
      {
        path: 'forgot-password',
        title: 'Reset password | Roleveya',
        loadComponent: () => import('./features/auth/forgot-password').then((m) => m.ForgotPassword),
      },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    canActivate: [signedInGuard],
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard | Roleveya',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      { path: 'jobs', title: 'Jobs | Roleveya', loadComponent: () => import('./features/jobs/job-list').then((m) => m.JobList) },
      {
        path: 'jobs/new',
        title: 'Add a job | Roleveya',
        loadComponent: () => import('./features/jobs/job-form').then((m) => m.JobForm),
      },
      {
        path: 'jobs/:id',
        title: 'Job | Roleveya',
        loadComponent: () => import('./features/jobs/job-detail').then((m) => m.JobDetail),
      },
      {
        path: 'jobs/:id/edit',
        title: 'Edit job | Roleveya',
        loadComponent: () => import('./features/jobs/job-form').then((m) => m.JobForm),
      },
      {
        path: 'jobs/:id/tailor',
        title: 'Tailor CV | Roleveya',
        loadComponent: () => import('./features/studio/tailor').then((m) => m.Tailor),
      },
      {
        path: 'studio',
        title: 'CV studio | Roleveya',
        loadComponent: () => import('./features/studio/studio').then((m) => m.Studio),
      },
      {
        path: 'studio/versions/:id',
        title: 'Saved CV | Roleveya',
        loadComponent: () => import('./features/studio/version-view').then((m) => m.VersionView),
      },
      {
        path: 'studio/:id',
        title: 'Master CV | Roleveya',
        loadComponent: () => import('./features/studio/master-editor').then((m) => m.MasterEditor),
        canDeactivate: [unsavedChangesGuard],
      },
      {
        path: 'history',
        title: 'History | Roleveya',
        loadComponent: () => import('./features/history/history').then((m) => m.History),
      },
      { path: 'cvs', title: 'CVs | Roleveya', loadComponent: () => import('./features/cvs/cvs').then((m) => m.Cvs) },
      {
        path: 'preferences',
        title: 'Preferences | Roleveya',
        loadComponent: () => import('./features/preferences/preferences').then((m) => m.PreferencesPage),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
