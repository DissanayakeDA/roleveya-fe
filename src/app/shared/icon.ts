import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const PATHS = {
  dashboard: 'M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6v-9h-6v9zm0-16v5h6V4h-6z',
  jobs: 'M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6M3.5 6h17a.5.5 0 0 1 .5.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5a.5.5 0 0 1 .5-.5zM3 12h18',
  history: 'M12 7v5l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4',
  cv: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5M9 13h6M9 17h6',
  preferences: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  plus: 'M12 5v14M5 12h14',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  external: 'M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4',
  back: 'M15 6l-6 6 6 6',
} as const;

export type IconName = keyof typeof PATHS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', style: 'display:inline-flex' },
  template: `<svg
    [attr.width]="size()"
    [attr.height]="size()"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path [attr.d]="path()" />
  </svg>`,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  protected readonly path = computed(() => PATHS[this.name()]);
}
