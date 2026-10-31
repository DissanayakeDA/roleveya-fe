import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ApplicationStatus, STATUS_LABELS, STATUS_TONES } from '../core/models';

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="'tone-' + tone()">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<ApplicationStatus>();
  protected readonly label = computed(() => STATUS_LABELS[this.status()]);
  protected readonly tone = computed(() => STATUS_TONES[this.status()]);
}
