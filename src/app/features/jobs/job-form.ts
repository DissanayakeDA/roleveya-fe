import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, of, switchMap } from 'rxjs';

import { CvsApi, JobsApi, PreferencesApi, StudioApi } from '../../core/api.service';
import { today } from '../../core/format';
import { errorMessage } from '../../core/http';
import {
  ALL_STATUSES,
  ApplicationStatus,
  Cv,
  CvDocumentSummary,
  EMPLOYMENT_TYPE_LABELS,
  EmploymentType,
  JOB_SOURCES,
  Job,
  JobInput,
  MIN_DESCRIPTION_TO_COMPARE,
  PRIORITY_LABELS,
  Priority,
  STATUS_LABELS,
  StudioStatus,
  WORK_MODE_LABELS,
  WorkMode,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { PostRead, PostReader } from './post-reader';

const CURRENCIES = ['LKR', 'USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'AED'];

/** Fields a post can fill, with how the result message names them. */
const FILLABLE = {
  company: 'company',
  title: 'job title',
  description: 'description',
  location: 'location',
  work_mode: 'work arrangement',
  employment_type: 'employment type',
  job_url: 'link',
  source: 'source',
} as const;
type FillableField = keyof typeof FILLABLE;

/** For a new job: tailor a CV to the post after adding it, or pick a CV already sent. */
type CvPlan = 'tailor' | 'existing';

/** Fields under "More details". When editing, the section starts open if any of them has a value. */
const DETAIL_FIELDS = [
  'location',
  'work_mode',
  'employment_type',
  'source',
  'job_url',
  'deadline',
  'salary_min',
  'salary_max',
  'salary_currency',
  'contact_name',
  'contact_email',
  'notes',
] as const;

@Component({
  selector: 'app-job-form',
  imports: [ReactiveFormsModule, RouterLink, PostReader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './job-form.html',
  styleUrl: './job-form.scss',
  host: { '(window:focus)': 'refreshMasters()' },
})
export class JobForm {
  private readonly jobs = inject(JobsApi);
  private readonly cvsApi = inject(CvsApi);
  private readonly prefsApi = inject(PreferencesApi);
  private readonly studio = inject(StudioApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Present when editing (route `jobs/:id/edit`). */
  readonly id = input<string>();
  protected readonly editing = computed(() => !!this.id());

  protected readonly statuses = ALL_STATUSES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly workModes = Object.entries(WORK_MODE_LABELS) as [WorkMode, string][];
  protected readonly employmentTypes = Object.entries(EMPLOYMENT_TYPE_LABELS) as [EmploymentType, string][];
  protected readonly priorities = Object.entries(PRIORITY_LABELS) as [Priority, string][];
  protected readonly sources = JOB_SOURCES;
  protected readonly currencies = CURRENCIES;

  protected readonly cvs = signal<Cv[]>([]);
  protected readonly masters = signal<CvDocumentSummary[]>([]);
  protected readonly studioStatus = signal<StudioStatus | null>(null);
  protected readonly minDescription = MIN_DESCRIPTION_TO_COMPARE;
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly posterFile = signal<File | null>(null);
  /** The screenshot the form was filled from, saved as the poster unless another file is chosen. */
  protected readonly screenshot = signal<File | null>(null);
  protected readonly fillNote = signal<{ tone: 'info' | 'warn'; text: string } | null>(null);
  protected readonly moreOpen = signal(false);
  private readonly filledFromPost = signal<ReadonlySet<FillableField>>(new Set());
  private loadedJob: Job | null = null;

  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', Validators.maxLength(200)],
    company: ['', [Validators.required, Validators.maxLength(200)]],
    location: [''],
    work_mode: ['' as WorkMode | ''],
    employment_type: ['' as EmploymentType | ''],
    job_url: ['', Validators.pattern(/^https?:\/\/\S+$/)],
    source: [''],
    status: ['saved' as ApplicationStatus],
    applied_on: [''],
    deadline: [''],
    priority: ['medium' as Priority],
    cv_id: [''],
    // Not saved with the job: they decide where "Add job" goes next.
    cv_plan: ['existing' as CvPlan],
    master_id: [''],
    salary_min: [null as number | null, Validators.min(0)],
    salary_max: [null as number | null, Validators.min(0)],
    salary_currency: ['', Validators.pattern(/^[A-Za-z]{3}$/)],
    contact_name: [''],
    contact_email: ['', Validators.email],
    description: [''],
    notes: [''],
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });

    const { status, applied_on } = this.form.controls;
    // Moving past "Saved" on a new job usually means it was just applied for.
    status.valueChanges.subscribe((value) => {
      if (!this.editing() && value !== 'saved' && !applied_on.value) {
        applied_on.setValue(today());
      }
    });
    // Until the stage is picked by hand, it follows the applied date: a date means "Applied", none "Saved".
    applied_on.valueChanges.subscribe((date) => {
      if (!this.editing() && status.pristine) {
        status.setValue(date ? 'applied' : 'saved', { emitEvent: false });
      }
    });
  }

  private load(id: string | undefined): void {
    this.loading.set(true);
    const job$: Observable<Job | null> = id ? this.jobs.get(id) : of(null);
    // The form works without the CV studio, so its data is optional.
    const masters$ = id ? of([]) : this.studio.documents().pipe(catchError(() => of([])));
    const studio$ = id ? of(null) : this.studio.status().pipe(catchError(() => of(null)));
    forkJoin({
      cvs: this.cvsApi.list(),
      job: job$,
      prefs: id ? of(null) : this.prefsApi.get(),
      masters: masters$,
      studio: studio$,
    }).subscribe({
      next: ({ cvs, job, prefs, masters, studio }) => {
        this.cvs.set(cvs);
        this.studioStatus.set(studio);
        this.setMasters(masters);
        if (job) {
          this.loadedJob = job;
          this.form.patchValue({
            ...job,
            location: job.location ?? '',
            work_mode: job.work_mode ?? '',
            employment_type: job.employment_type ?? '',
            job_url: job.job_url ?? '',
            source: job.source ?? '',
            applied_on: job.applied_on ?? '',
            deadline: job.deadline ?? '',
            cv_id: job.cv?.id ?? '',
            salary_currency: job.salary_currency ?? '',
            contact_name: job.contact_name ?? '',
            contact_email: job.contact_email ?? '',
            description: job.description ?? '',
            notes: job.notes ?? '',
          });
          this.moreOpen.set(DETAIL_FIELDS.some((field) => job[field] !== null && job[field] !== ''));
        } else {
          // Most jobs are logged on the day they're applied for.
          this.form.patchValue({
            applied_on: today(),
            cv_id: cvs.find((cv) => cv.is_default)?.id ?? '',
            salary_currency: prefs?.salary_currency ?? '',
          });
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(errorMessage(err, "The form couldn't be loaded. Refresh to try again."));
      },
    });
  }

  /** Tailoring is the default once there's a master CV to start from, unless the user already chose. */
  private setMasters(masters: CvDocumentSummary[]): void {
    this.masters.set(masters);
    const { cv_plan, master_id } = this.form.controls;
    if (!masters.some((master) => master.id === master_id.value)) {
      master_id.setValue(masters[0]?.id ?? '');
    }
    if (cv_plan.pristine) {
      cv_plan.setValue(masters.length ? 'tailor' : 'existing');
    }
  }

  /** After making a master CV in another tab, coming back to the form offers tailoring without a reload. */
  protected refreshMasters(): void {
    if (this.editing() || this.loading() || this.masters().length) return;
    this.studio.documents().subscribe({ next: (masters) => this.setMasters(masters), error: () => {} });
  }

  protected tailoring(): boolean {
    return !this.editing() && this.form.controls.cv_plan.value === 'tailor' && this.masters().length > 0;
  }

  protected masterName(): string {
    return this.masters().find((master) => master.id === this.form.controls.master_id.value)?.name ?? '';
  }

  protected descriptionTooShort(): boolean {
    return this.form.controls.description.value.trim().length < MIN_DESCRIPTION_TO_COMPARE;
  }

  /** Fills the form from a post. Anything the user already typed is kept. */
  protected applyRead({ found, from }: PostRead): void {
    if (!found.found_text) {
      this.fillNote.set({
        tone: 'warn',
        text:
          from === 'screenshot'
            ? 'No text was found in that screenshot. Try a sharper one, or paste the text instead.'
            : 'There was no text to read.',
      });
      return;
    }

    const filled = new Set<FillableField>();
    for (const field of Object.keys(FILLABLE) as FillableField[]) {
      const value = found[field];
      // The fields hold different value types; the API only returns values valid for each.
      const control: AbstractControl = this.form.controls[field];
      if (!value || (control.dirty && control.value)) {
        continue;
      }
      control.setValue(value);
      control.markAsPristine();
      filled.add(field);
    }
    this.filledFromPost.set(filled);
    this.fillNote.set(this.describeFill(filled));
  }

  /** True while a field still holds what the post filled in (it stops once the user edits it). */
  protected fromPost(field: FillableField): boolean {
    return this.filledFromPost().has(field) && this.form.controls[field].pristine;
  }

  protected detailsHint(): string {
    const filled = DETAIL_FIELDS.filter((field) => this.filledFromPost().has(field as FillableField)).map(
      (field) => FILLABLE[field as FillableField],
    );
    if (filled.length) {
      return `Includes the ${listOf(filled)} from the post.`;
    }
    return this.editing() ? 'Location, pay, contact and notes.' : 'Stage, deadline, location, pay, contact, notes and poster.';
  }

  protected onToggle(event: Event): void {
    this.moreOpen.set((event.target as HTMLDetailsElement).open);
  }

  protected pickPoster(input: HTMLInputElement): void {
    const file = input.files?.[0] ?? null;
    if (file && file.size > 5 * 1024 * 1024) {
      input.value = '';
      this.toast.error('Posters must be 5 MB or smaller.');
      return;
    }
    this.posterFile.set(file);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (DETAIL_FIELDS.some((field) => this.form.controls[field].invalid)) {
        this.moreOpen.set(true);
      }
      this.error.set('Some fields need attention before saving.');
      return;
    }
    const body = this.toInput();
    if (body.salary_min !== null && body.salary_max !== null && body.salary_min > body.salary_max) {
      this.moreOpen.set(true);
      this.error.set("Minimum salary can't be higher than maximum salary.");
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const id = this.id();
    const save$ = id ? this.jobs.update(id, body) : this.jobs.create(body);
    const poster = this.posterFile() ?? this.screenshot();
    const master = this.tailoring() ? this.form.controls.master_id.value : null;

    save$
      .pipe(switchMap((job) => (poster && !id ? this.jobs.uploadPoster(job.id, poster) : of(job))))
      .subscribe({
        next: (job) => {
          this.toast.show(id ? 'Changes saved.' : 'Job added.');
          if (master) {
            this.router.navigate(['/jobs', job.id, 'tailor'], { queryParams: { master } });
          } else {
            this.router.navigate(['/jobs', job.id]);
          }
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(errorMessage(err));
        },
      });
  }

  protected cancelLink(): string[] {
    return this.loadedJob ? ['/jobs', this.loadedJob.id] : ['/jobs'];
  }

  private describeFill(filled: ReadonlySet<FillableField>): { tone: 'info' | 'warn'; text: string } {
    const main = (['company', 'title', 'description'] as const).filter((field) => filled.has(field)).map((f) => FILLABLE[f]);
    const extra = filled.size - main.length;
    const missingCompany = !filled.has('company') && !this.form.controls.company.value.trim();
    if (!filled.size) {
      return { tone: 'warn', text: "The job details couldn't be picked out of that. Fill them in below." };
    }
    const parts = extra ? [...main, `${extra} more ${extra === 1 ? 'detail' : 'details'}`] : main;
    const text = `Filled in the ${listOf(parts)}.`;
    return missingCompany
      ? { tone: 'warn', text: `${text} The company name wasn't found, so type it in.` }
      : { tone: 'info', text: `${text} Check them before saving.` };
  }

  private toInput(): JobInput {
    const v = this.form.getRawValue();
    const text = (value: string) => value.trim() || null;
    const amount = (value: number | null) => (value === null || (value as unknown) === '' ? null : Number(value));
    const body: JobInput = {
      title: v.title.trim(),
      company: v.company.trim(),
      location: text(v.location),
      work_mode: v.work_mode || null,
      employment_type: v.employment_type || null,
      job_url: text(v.job_url),
      source: text(v.source),
      salary_min: amount(v.salary_min),
      salary_max: amount(v.salary_max),
      salary_currency: text(v.salary_currency)?.toUpperCase() ?? null,
      description: text(v.description),
      notes: text(v.notes),
      contact_name: text(v.contact_name),
      contact_email: text(v.contact_email),
      priority: v.priority,
      deadline: v.deadline || null,
      applied_on: v.applied_on || null,
      // A tailored CV becomes the CV sent when its version is saved.
      cv_id: this.tailoring() ? null : v.cv_id || null,
    };
    if (!this.editing()) {
      body.status = v.status;
    }
    return body;
  }
}

/** "a", "a and b", "a, b and c" */
function listOf(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
