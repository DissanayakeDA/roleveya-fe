import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, debounceTime, filter, forkJoin, of, switchMap } from 'rxjs';

import { JobsApi, StudioApi } from '../../core/api.service';
import { fileName, roleTitle, saveFile } from '../../core/format';
import { errorMessage } from '../../core/http';
import {
  CvAnalysis,
  CvDocument,
  CvDocumentSummary,
  CvEdit,
  CvVersionSummary,
  Job,
  MIN_DESCRIPTION_TO_COMPARE,
  StudioStatus,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../shared/icon';
import { RoleTitlePipe } from '../../shared/role-title.pipe';
import { CompileState } from './compile-state';
import { LatexEditor } from './latex-editor';
import { PdfPane } from './pdf-pane';

type Tab = 'suggestions' | 'latex';
type EditState = 'ready' | 'applied' | 'missing';

@Component({
  selector: 'app-tailor',
  imports: [DatePipe, FormsModule, RouterLink, Icon, LatexEditor, PdfPane, RoleTitlePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tailor.html',
  styleUrls: ['./studio-shared.scss', './tailor.scss'],
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class Tailor {
  private readonly jobsApi = inject(JobsApi);
  private readonly api = inject(StudioApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly editor = viewChild(LatexEditor);

  /** The job's id (route `jobs/:id/tailor`). */
  readonly id = input.required<string>();
  /** `?master=` from "Add job and tailor CV": copy that master CV and compare it with the post straight away. */
  readonly master = input<string>();

  protected readonly compiler = new CompileState();
  protected readonly job = signal<Job | null>(null);
  protected readonly status = signal<StudioStatus | null>(null);
  protected readonly masters = signal<CvDocumentSummary[]>([]);
  protected readonly draft = signal<CvDocument | null>(null);
  protected readonly versions = signal<CvVersionSummary[]>([]);
  protected readonly loadError = signal<string | null>(null);
  protected readonly loaded = signal(false);

  protected readonly source = signal('');
  private readonly savedSource = signal('');
  protected readonly saveFailed = signal(false);
  protected readonly tab = signal<Tab>('suggestions');

  protected readonly picking = signal(false);
  protected readonly starting = signal(false);
  protected masterId = '';

  protected readonly analysis = signal<CvAnalysis | null>(null);
  /** The CV text the shown analysis was made from (null when unknown, e.g. an older one from the server). */
  private readonly analysedSource = signal<string | null>(null);
  protected readonly analysing = signal(false);
  protected readonly analysisError = signal<string | null>(null);
  private readonly applied = signal<ReadonlySet<number>>(new Set());

  protected readonly makingWord = signal(false);
  protected readonly savingVersion = signal(false);
  protected versionName = '';
  protected useForJob = true;

  protected readonly unsaved = computed(() => this.source() !== this.savedSource());
  protected readonly stale = computed(() => {
    const compiled = this.compiler.compiledSource();
    return compiled !== null && compiled !== this.source();
  });
  protected readonly pdfReady = computed(() => this.compiler.pdfUrl() !== null && !this.stale());
  protected readonly hasDescription = computed(
    () => (this.job()?.description ?? '').trim().length >= MIN_DESCRIPTION_TO_COMPARE,
  );
  protected readonly analysisCurrent = computed(() => {
    const made = this.analysedSource();
    return made === null ? (this.analysis()?.current ?? false) : made === this.source();
  });
  protected readonly editStates = computed<EditState[]>(() => {
    const source = this.source();
    const applied = this.applied();
    return (this.analysis()?.edits ?? []).map((edit, index) => {
      if (applied.has(index) && source.includes(edit.replace)) return 'applied';
      return occurrences(source, edit.find) === 1 ? 'ready' : 'missing';
    });
  });
  protected readonly coverage = computed(() => {
    const analysis = this.analysis();
    if (!analysis) return null;
    const matched = analysis.matched_skills.length;
    return { matched, total: matched + analysis.missing_skills.length };
  });
  protected readonly requiredGaps = computed(() =>
    (this.analysis()?.missing_skills ?? []).filter((gap) => gap.importance === 'required').length,
  );

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });

    // The working copy saves itself a moment after each change.
    toObservable(this.source)
      .pipe(
        debounceTime(1200),
        filter((latex) => !!this.draft() && latex !== this.savedSource() && latex.trim().length > 0),
        switchMap((latex) =>
          this.api.updateDocument(this.draft()!.id, { latex }).pipe(
            catchError(() => {
              this.saveFailed.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((doc) => {
        if (doc) {
          this.saveFailed.set(false);
          this.savedSource.set(doc.latex);
        }
      });

    // Edits made just before leaving the page would otherwise miss the delayed save.
    inject(DestroyRef).onDestroy(() => {
      const draft = this.draft();
      if (draft && this.unsaved() && this.source().trim()) {
        this.api.updateDocument(draft.id, { latex: this.source() }).subscribe({ error: () => {} });
      }
    });
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.draft() && this.unsaved()) {
      event.preventDefault();
    }
  }

  private load(id: string): void {
    forkJoin({
      job: this.jobsApi.get(id),
      status: this.api.status(),
      masters: this.api.documents(),
      tailoring: this.api.tailoring(id),
    }).subscribe({
      next: ({ job, status, masters, tailoring }) => {
        this.job.set(job);
        this.status.set(status);
        this.masters.set(masters);
        this.versions.set(tailoring.versions);
        this.analysis.set(tailoring.analysis);
        this.masterId = masters[0]?.id ?? '';
        this.versionName = `${job.company} CV`.slice(0, 120);
        if (tailoring.draft) {
          this.useDraft(tailoring.draft);
          this.analysedSource.set(tailoring.analysis?.current ? tailoring.draft.latex : null);
        }
        this.loaded.set(true);
        this.startFromAddJob(this.master(), masters, tailoring.draft !== null);
      },
      error: (err) => this.loadError.set(errorMessage(err, "This job couldn't be loaded.")),
    });
  }

  private useDraft(draft: CvDocument): void {
    this.draft.set(draft);
    this.savedSource.set(draft.latex);
    this.source.set(draft.latex);
    this.applied.set(new Set());
    if (this.status()?.compiler) {
      this.compiler.run(draft.latex);
    }
  }

  protected masterName(id: string | null): string | null {
    return this.masters().find((master) => master.id === id)?.name ?? null;
  }

  /** Coming from "Add job and tailor CV": skips the master picker and the compare button. */
  private startFromAddJob(master: string | undefined, masters: CvDocumentSummary[], hasDraft: boolean): void {
    if (!master) return;
    // Drop ?master= so reloading the page doesn't start over.
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    if (hasDraft || !masters.some((doc) => doc.id === master)) return;
    this.masterId = master;
    this.startDraft(() => {
      if (this.hasDescription() && this.status()?.ai) {
        this.analyse();
      }
    });
  }

  protected startDraft(then?: () => void): void {
    if (!this.masterId) return;
    this.starting.set(true);
    this.api.startDraft(this.id(), this.masterId).subscribe({
      next: (draft) => {
        this.starting.set(false);
        this.picking.set(false);
        this.analysedSource.set(null);
        this.useDraft(draft);
        this.tab.set('suggestions');
        then?.();
      },
      error: (err) => {
        this.starting.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected compile(): void {
    if (this.status()?.compiler) {
      this.compiler.run(this.source());
    }
  }

  protected analyse(refresh = false): void {
    this.analysing.set(true);
    this.analysisError.set(null);
    const latex = this.source();
    this.api.analyse(this.id(), latex, refresh).subscribe({
      next: (analysis) => {
        this.analysing.set(false);
        this.analysis.set(analysis);
        this.analysedSource.set(latex);
        this.applied.set(new Set());
      },
      error: (err) => {
        this.analysing.set(false);
        this.analysisError.set(errorMessage(err, "The comparison didn't work. Try again."));
      },
    });
  }

  protected apply(index: number, edit: CvEdit): void {
    const source = this.source();
    const at = source.indexOf(edit.find);
    if (at < 0 || occurrences(source, edit.find) !== 1) return;
    this.changeKeepingAnalysis(source.slice(0, at) + edit.replace + source.slice(at + edit.find.length));
    this.applied.update((set) => new Set(set).add(index));
    this.toast.show('Applied. Compile to see it in the preview.');
  }

  protected undo(index: number, edit: CvEdit): void {
    const source = this.source();
    const at = source.indexOf(edit.replace);
    if (at >= 0) {
      this.changeKeepingAnalysis(source.slice(0, at) + edit.find + source.slice(at + edit.replace.length));
    }
    this.applied.update((set) => {
      const next = new Set(set);
      next.delete(index);
      return next;
    });
  }

  /** Applying or undoing a suggestion doesn't make the comparison it came from out of date. */
  private changeKeepingAnalysis(latex: string): void {
    const wasCurrent = this.analysisCurrent();
    this.source.set(latex);
    if (wasCurrent) {
      this.analysedSource.set(latex);
    }
  }

  /** Opens the LaTeX tab with the suggestion's text selected. */
  protected show(edit: CvEdit, state: EditState): void {
    const text = state === 'applied' ? edit.replace : edit.find;
    const at = this.source().indexOf(text);
    this.tab.set('latex');
    if (at >= 0) {
      setTimeout(() => this.editor()?.select(at, at + text.length));
    }
  }

  protected goToLine(line: number): void {
    this.tab.set('latex');
    setTimeout(() => this.editor()?.goToLine(line));
  }

  protected downloadPdf(): void {
    const pdf = this.compiler.pdf();
    if (pdf && this.pdfReady()) {
      saveFile(pdf, fileName(this.versionName, 'pdf'));
    }
  }

  protected downloadWord(): void {
    this.makingWord.set(true);
    this.api.word(this.source(), this.versionName).subscribe({
      next: (blob) => {
        this.makingWord.set(false);
        saveFile(blob, fileName(this.versionName, 'docx'));
      },
      error: (err) => {
        this.makingWord.set(false);
        this.toast.error(errorMessage(err, "The Word file couldn't be made."));
      },
    });
  }

  protected saveVersion(): void {
    const name = this.versionName.trim();
    if (!name) return;
    this.savingVersion.set(true);
    const latex = this.source();
    this.api.saveVersion(this.id(), { name, latex, use_for_job: this.useForJob }).subscribe({
      next: (version) => {
        this.savingVersion.set(false);
        this.savedSource.set(latex);
        this.versions.update((list) => [version, ...list]);
        if (this.useForJob) {
          this.job.update((job) =>
            job ? { ...job, cv: { id: version.cv_id, label: name, original_filename: `${name}.pdf`, version_id: version.id } } : job,
          );
        }
        this.toast.show(this.useForJob ? 'Version saved and set as the CV sent for this job.' : 'Version saved.');
      },
      error: (err) => {
        this.savingVersion.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected jobLabel(job: Job): string {
    return `${job.company}, ${roleTitle(job.title)}`;
  }
}

function occurrences(text: string, part: string): number {
  if (!part) return 0;
  let count = 0;
  for (let at = text.indexOf(part); at >= 0 && count < 2; at = text.indexOf(part, at + 1)) {
    count++;
  }
  return count;
}
