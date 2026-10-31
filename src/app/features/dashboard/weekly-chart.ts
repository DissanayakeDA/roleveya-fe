import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

interface Week {
  week_start: string;
  count: number;
}

/** Rounds the axis up to a clean step (1, 2, 5, 10, 20, 50, …) with at most four intervals. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  let step = 1;
  for (let magnitude = 1; ; magnitude *= 10) {
    const found = [1, 2, 5].map((m) => m * magnitude).find((s) => max / s <= 4);
    if (found) {
      step = found;
      break;
    }
  }
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

/** Applications sent per week: one series, columns from a shared baseline. */
@Component({
  selector: 'app-weekly-chart',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './weekly-chart.html',
  styleUrl: './weekly-chart.scss',
})
export class WeeklyChart {
  readonly weeks = input.required<Week[]>();
  protected readonly showTable = signal(false);

  protected readonly ticks = computed(() => niceTicks(Math.max(0, ...this.weeks().map((w) => w.count))));
  protected readonly top = computed(() => this.ticks()[this.ticks().length - 1]);
  protected readonly total = computed(() => this.weeks().reduce((sum, w) => sum + w.count, 0));
  protected readonly lastIndex = computed(() => this.weeks().length - 1);

  protected height(count: number): number {
    return (count / this.top()) * 100;
  }

  protected tickPosition(tick: number): number {
    return (tick / this.top()) * 100;
  }

  protected plural(count: number): string {
    return count === 1 ? '1 application' : `${count} applications`;
  }
}
