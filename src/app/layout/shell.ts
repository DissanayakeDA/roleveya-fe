import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { AuthService } from '../core/auth.service';
import { Icon, IconName } from '../shared/icon';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly menuOpen = signal(false);
  protected readonly signingOut = signal(false);

  protected readonly nav: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: '/jobs', label: 'Jobs', icon: 'jobs' },
    { path: '/history', label: 'History', icon: 'history' },
    { path: '/cvs', label: 'CVs', icon: 'cv' },
    { path: '/preferences', label: 'Preferences', icon: 'preferences' },
  ];

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  protected signOut(): void {
    this.signingOut.set(true);
    this.auth.logout().subscribe({
      complete: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login'),
    });
  }
}
