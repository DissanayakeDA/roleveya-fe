import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { InsightsApi } from '../../core/api.service';
import { describeEvent } from '../../core/format';
import { RoleTitlePipe } from '../../shared/role-title.pipe';
import { errorMessage } from '../../core/http';
import { ApplicationEventWithJob, EventType } from '../../core/models';

const FILTERS: { value: EventType | null; label: string }[] = [
  { value: null, label: 'Everything' },
  { value: 'status_changed', label: 'Stage changes' },
  { value: 'note', label: 'Notes' },
  { value: 'created', label: 'Jobs added' },
];

interface Day {
  key: string;
  date: string;
  events: ApplicationEventWithJob[];
}

@Component({
  selector: 'app-history',
  imports: [RouterLink, DatePipe, RoleTitlePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History {
  private readonly api = inject(InsightsApi);

  protected readonly filters = FILTERS;
  protected readonly describe = describeEvent;
  protected readonly filter = signal<EventType | null>(null);
  protected readonly events = signal<ApplicationEventWithJob[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private page = 1;

  /** Entries grouped under the local calendar day they happened. */
  protected readonly days = computed<Day[]>(() => {
    const groups = new Map<string, Day>();
    for (const event of this.events()) {
      const local = new Date(event.occurred_at);
      const key = `${local.getFullYear()}-${local.getMonth()}-${local.getDate()}`;
      if (!groups.has(key)) {
        groups.set(key, { key, date: event.occurred_at, events: [] });
      }
      groups.get(key)!.events.push(event);
    }
    return [...groups.values()];
  });

  protected readonly hasMore = computed(() => this.events().length < this.total());

  constructor() {
    this.load(true);
  }

  protected setFilter(value: EventType | null): void {
    if (value === this.filter()) return;
    this.filter.set(value);
    this.load(true);
  }

  protected loadMore(): void {
    this.load(false);
  }

  private load(reset: boolean): void {
    this.page = reset ? 1 : this.page + 1;
    this.loading.set(true);
    this.api.history(this.page, this.filter()).subscribe({
      next: (page) => {
        this.events.update((list) => (reset ? page.items : [...list, ...page.items]));
        this.total.set(page.total);
        this.loading.set(false);
        this.error.set(null);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(errorMessage(err, "History couldn't be loaded. Refresh to try again."));
      },
    });
  }
}
