import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { InsightsApi } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { describeEvent, dueLabel, percent } from '../../core/format';
import { errorMessage } from '../../core/http';
import { DashboardSummary, EXIT_STATUSES, ROUTE_STATUSES, STATUS_LABELS } from '../../core/models';
import { Icon } from '../../shared/icon';
import { RoleTitlePipe } from '../../shared/role-title.pipe';
import { WeeklyChart } from './weekly-chart';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, WeeklyChart, Icon, RoleTitlePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly auth = inject(AuthService);
  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly labels = STATUS_LABELS;
  protected readonly percent = percent;
  protected readonly describe = describeEvent;
  protected readonly due = dueLabel;

  /** Stage rows for the pipeline, main line first, then the closed outcomes. */
  protected readonly pipeline = computed(() => {
    const summary = this.summary();
    if (!summary) return null;
    const max = Math.max(1, ...Object.values(summary.by_status));
    const row = (status: (typeof ROUTE_STATUSES)[number]) => ({
      status,
      count: summary.by_status[status] ?? 0,
      width: ((summary.by_status[status] ?? 0) / max) * 100,
    });
    return { route: ROUTE_STATUSES.map(row), exits: EXIT_STATUSES.map(row) };
  });

  protected readonly offers = computed(() => {
    const s = this.summary();
    return s ? s.by_status.offer + s.by_status.accepted : 0;
  });

  constructor() {
    inject(InsightsApi)
      .dashboard()
      .subscribe({
        next: (summary) => this.summary.set(summary),
        error: (err) => this.error.set(errorMessage(err, "The dashboard couldn't be loaded. Refresh to try again.")),
      });
  }
}
