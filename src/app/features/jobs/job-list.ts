import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs';

import { JobsApi } from '../../core/api.service';
import { salaryRange } from '../../core/format';
import { errorMessage } from '../../core/http';
import {
  ALL_STATUSES,
  ApplicationStatus,
  JobFilters,
  JobListItem,
  JobSort,
  STATUS_LABELS,
  WORK_MODE_LABELS,
} from '../../core/models';
import { Icon } from '../../shared/icon';
import { RoleTitlePipe } from '../../shared/role-title.pipe';
import { StatusBadge } from '../../shared/status-badge';

const PAGE_SIZE = 20;
const SORTS: { value: JobSort; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'created', label: 'Recently added' },
  { value: 'deadline', label: 'Deadline, soonest first' },
  { value: 'applied', label: 'Applied, newest first' },
  { value: 'company', label: 'Company, A to Z' },
];

@Component({
  selector: 'app-job-list',
  imports: [RouterLink, DatePipe, StatusBadge, Icon, RoleTitlePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-list.html',
  styleUrl: './job-list.scss',
})
export class JobList {
  private readonly api = inject(JobsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly statuses = ALL_STATUSES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly workModes = WORK_MODE_LABELS;
  protected readonly sorts = SORTS;
  protected readonly salary = salaryRange;

  protected readonly filters = signal<JobFilters>({ status: [], q: '', sort: 'updated', page: 1 });
  protected readonly items = signal<JobListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  protected readonly filtered = computed(() => this.filters().status.length > 0 || this.filters().q.trim() !== '');

  private readonly search$ = new Subject<string>();

  constructor() {
    // The URL is the source of truth, so filtered views can be linked to and survive Back.
    this.route.queryParamMap
      .pipe(
        map((params) => this.fromParams(params.get('status'), params.get('q'), params.get('sort'), params.get('page'))),
        tap((filters) => {
          this.filters.set(filters);
          this.loading.set(true);
        }),
        switchMap((filters) =>
          this.api.list(filters, PAGE_SIZE).pipe(
            catchError((err) => {
              this.loading.set(false);
              this.error.set(errorMessage(err, "Jobs couldn't be loaded. Refresh to try again."));
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.items.set(page.items);
        this.total.set(page.total);
        this.loading.set(false);
        this.error.set(null);
      });

    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.apply({ q, page: 1 }));
  }

  protected onSearch(value: string): void {
    this.search$.next(value);
  }

  protected toggleStatus(status: ApplicationStatus): void {
    const current = this.filters().status;
    const next = current.includes(status) ? current.filter((s) => s !== status) : [...current, status];
    this.apply({ status: next, page: 1 });
  }

  protected clearFilters(): void {
    this.apply({ status: [], q: '', page: 1 });
  }

  protected apply(change: Partial<JobFilters>): void {
    const next = { ...this.filters(), ...change };
    this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        status: next.status.length ? next.status.join(',') : null,
        q: next.q.trim() || null,
        sort: next.sort !== 'updated' ? next.sort : null,
        page: next.page > 1 ? next.page : null,
      },
    });
  }

  protected sortChanged(value: string): void {
    this.apply({ sort: value as JobSort, page: 1 });
  }

  private fromParams(status: string | null, q: string | null, sort: string | null, page: string | null): JobFilters {
    const statuses = (status ?? '')
      .split(',')
      .filter((s): s is ApplicationStatus => (ALL_STATUSES as string[]).includes(s));
    const validSort = SORTS.some((option) => option.value === sort) ? (sort as JobSort) : 'updated';
    return { status: statuses, q: q ?? '', sort: validSort, page: Math.max(1, Number(page) || 1) };
  }
}
