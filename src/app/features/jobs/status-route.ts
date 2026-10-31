import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApplicationStatus, EXIT_STATUSES, ROUTE_STATUSES, STATUS_LABELS, STATUS_TONES } from '../../core/models';

export interface StatusMove {
  status: ApplicationStatus;
  note: string | null;
}

/**
 * The application's journey drawn as a transit line: stations from Saved to Accepted, with the current
 * stage marked, plus the ways an application can close. Choosing a station moves the application there.
 */
@Component({
  selector: 'app-status-route',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './status-route.html',
  styleUrl: './status-route.scss',
})
export class StatusRoute {
  readonly status = input.required<ApplicationStatus>();
  /** Index of the furthest stage on the main line this application has reached. */
  readonly reached = input(0);
  readonly busy = input(false);
  readonly move = output<StatusMove>();

  protected readonly route = ROUTE_STATUSES;
  protected readonly exits = EXIT_STATUSES;
  protected readonly labels = STATUS_LABELS;
  protected readonly tones = STATUS_TONES;

  protected readonly pending = signal<ApplicationStatus | null>(null);
  protected note = '';

  protected readonly closed = computed(() => EXIT_STATUSES.includes(this.status()));

  constructor() {
    // A finished move (new status arrives) closes the confirmation strip.
    effect(() => {
      this.status();
      this.pending.set(null);
      this.note = '';
    });
  }

  protected stationState(index: number): 'passed' | 'here' | 'ahead' {
    if (!this.closed() && this.route[index] === this.status()) {
      return 'here';
    }
    return index <= this.reached() ? 'passed' : 'ahead';
  }

  protected pick(status: ApplicationStatus): void {
    if (status === this.status() || this.busy()) {
      return;
    }
    this.pending.set(status);
  }

  protected confirm(): void {
    const status = this.pending();
    if (status) {
      this.move.emit({ status, note: this.note.trim() || null });
    }
  }

  protected cancel(): void {
    this.pending.set(null);
    this.note = '';
  }
}
