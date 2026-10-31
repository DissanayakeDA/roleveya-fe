import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { JobsApi } from '../../core/api.service';
import { describeEvent, dueLabel, roleTitle, salaryRange } from '../../core/format';
import { errorMessage } from '../../core/http';
import {
  ApplicationEvent,
  EMPLOYMENT_TYPE_LABELS,
  Job,
  PRIORITY_LABELS,
  ROUTE_STATUSES,
  WORK_MODE_LABELS,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { FileViewer } from '../../shared/file-viewer';
import { Icon } from '../../shared/icon';
import { RoleTitlePipe } from '../../shared/role-title.pipe';
import { StatusBadge } from '../../shared/status-badge';
import { StatusMove, StatusRoute } from './status-route';

@Component({
  selector: 'app-job-detail',
  imports: [RouterLink, DatePipe, FormsModule, StatusRoute, StatusBadge, FileViewer, Icon, RoleTitlePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-detail.html',
  styleUrl: './job-detail.scss',
})
export class JobDetail {
  private readonly api = inject(JobsApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly viewer = viewChild.required(FileViewer);

  readonly id = input.required<string>();

  protected readonly job = signal<Job | null>(null);
  protected readonly events = signal<ApplicationEvent[]>([]);
  protected readonly loadError = signal<string | null>(null);
  protected readonly moving = signal(false);
  protected readonly confirmingDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly uploading = signal(false);
  protected readonly savingNote = signal(false);
  protected readonly posterPreview = signal<string | null>(null);
  protected noteText = '';

  protected readonly workModes = WORK_MODE_LABELS;
  protected readonly employmentTypes = EMPLOYMENT_TYPE_LABELS;
  protected readonly priorities = PRIORITY_LABELS;
  protected readonly describe = describeEvent;
  protected readonly due = dueLabel;

  protected readonly salary = computed(() => {
    const job = this.job();
    return job ? salaryRange(job.salary_min, job.salary_max, job.salary_currency) : null;
  });

  /** Furthest stage on the main line; for a closed application, where it got to before closing. */
  protected readonly reached = computed(() => {
    const job = this.job();
    if (!job) return 0;
    const current = ROUTE_STATUSES.indexOf(job.status);
    if (current >= 0) return current;
    let furthest = 0;
    for (const event of this.events()) {
      for (const status of [event.from_status, event.to_status]) {
        furthest = Math.max(furthest, status ? ROUTE_STATUSES.indexOf(status) : -1);
      }
    }
    return furthest;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
    inject(DestroyRef).onDestroy(() => this.clearPreview());
  }

  private load(id: string): void {
    this.loadError.set(null);
    forkJoin({ job: this.api.get(id), events: this.api.events(id) }).subscribe({
      next: ({ job, events }) => {
        this.job.set(job);
        this.events.set(events);
        this.loadPreview(job);
      },
      error: (err) => this.loadError.set(errorMessage(err, "This job couldn't be loaded.")),
    });
  }

  private refreshEvents(): void {
    this.api.events(this.id()).subscribe({ next: (events) => this.events.set(events) });
  }

  protected moveTo(move: StatusMove): void {
    this.moving.set(true);
    this.api.changeStatus(this.id(), move.status, move.note).subscribe({
      next: (job) => {
        this.moving.set(false);
        this.job.set(job);
        this.refreshEvents();
      },
      error: (err) => {
        this.moving.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected addNote(): void {
    const note = this.noteText.trim();
    if (!note) return;
    this.savingNote.set(true);
    this.api.addNote(this.id(), note).subscribe({
      next: (event) => {
        this.savingNote.set(false);
        this.noteText = '';
        this.events.update((list) => [event, ...list]);
      },
      error: (err) => {
        this.savingNote.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected removeNote(event: ApplicationEvent): void {
    this.api.removeNote(this.id(), event.id).subscribe({
      next: () => this.events.update((list) => list.filter((e) => e.id !== event.id)),
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }

  protected deleteJob(): void {
    this.deleting.set(true);
    this.api.remove(this.id()).subscribe({
      next: () => {
        this.toast.show('Job deleted.');
        this.router.navigateByUrl('/jobs');
      },
      error: (err) => {
        this.deleting.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected uploadPoster(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.toast.error('Posters must be 5 MB or smaller.');
      return;
    }
    this.uploading.set(true);
    this.api.uploadPoster(this.id(), file).subscribe({
      next: (job) => {
        this.uploading.set(false);
        this.job.set(job);
        this.loadPreview(job);
        this.toast.show('Poster uploaded.');
      },
      error: (err) => {
        this.uploading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected removePoster(): void {
    this.api.removePoster(this.id()).subscribe({
      next: (job) => {
        this.job.set(job);
        this.clearPreview();
        this.toast.show('Poster removed.');
      },
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }

  protected openPoster(): void {
    const job = this.job();
    if (!job?.has_poster) return;
    this.viewer().open({
      title: `Poster for ${roleTitle(job.title)}`,
      filename: job.poster_filename ?? 'poster',
      kind: job.poster_kind === 'pdf' ? 'pdf' : 'image',
      load: this.api.poster(job.id),
    });
  }

  protected openCv(): void {
    const cv = this.job()?.cv;
    if (!cv) return;
    this.router.navigate(['/cvs'], { queryParams: { open: cv.id } });
  }

  private loadPreview(job: Job): void {
    this.clearPreview();
    if (job.has_poster && job.poster_kind === 'image') {
      this.api.poster(job.id).subscribe({
        next: (blob) => this.posterPreview.set(URL.createObjectURL(blob)),
        error: () => {},
      });
    }
  }

  private clearPreview(): void {
    const url = this.posterPreview();
    if (url) URL.revokeObjectURL(url);
    this.posterPreview.set(null);
  }
}
