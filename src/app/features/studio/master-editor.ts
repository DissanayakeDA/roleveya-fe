import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin, of, switchMap, tap } from 'rxjs';

import { StudioApi } from '../../core/api.service';
import { fileName, saveFile } from '../../core/format';
import { HasUnsavedChanges } from '../../core/guards';
import { errorMessage } from '../../core/http';
import { CvDocument, StudioStatus } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../shared/icon';
import { CompileState } from './compile-state';
import { LatexEditor } from './latex-editor';
import { PdfPane } from './pdf-pane';

@Component({
  selector: 'app-master-editor',
  imports: [FormsModule, RouterLink, Icon, LatexEditor, PdfPane],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './master-editor.html',
  styleUrl: './studio-shared.scss',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class MasterEditor implements HasUnsavedChanges {
  private readonly api = inject(StudioApi);
  private readonly toast = inject(ToastService);
  private readonly editor = viewChild(LatexEditor);

  readonly id = input.required<string>();

  protected readonly compiler = new CompileState();
  protected readonly status = signal<StudioStatus | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly loaded = signal(false);
  protected readonly source = signal('');
  protected readonly name = signal('');
  private readonly saved = signal({ source: '', name: '' });
  protected readonly saving = signal(false);
  protected readonly makingWord = signal(false);
  protected readonly snapshotOpen = signal(false);
  protected readonly snapshotting = signal(false);
  protected snapshotName = '';

  protected readonly dirty = computed(
    () => this.source() !== this.saved().source || this.name().trim() !== this.saved().name,
  );
  protected readonly stale = computed(() => {
    const compiled = this.compiler.compiledSource();
    return compiled !== null && compiled !== this.source();
  });
  protected readonly pdfReady = computed(() => this.compiler.pdfUrl() !== null && !this.stale());

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private load(id: string): void {
    forkJoin({ doc: this.api.document(id), status: this.api.status() }).subscribe({
      next: ({ doc, status }) => {
        this.status.set(status);
        this.accept(doc);
        this.loaded.set(true);
        // Open at the CV itself rather than the setup commands above it.
        const body = doc.latex.split('\n').findIndex((line) => line.trimStart().startsWith('\\begin{document}'));
        if (body > 0) {
          setTimeout(() => this.editor()?.revealLine(body + 1));
        }
        if (status.compiler) {
          this.compiler.run(doc.latex);
        }
      },
      error: (err) => this.loadError.set(errorMessage(err, "This CV couldn't be loaded.")),
    });
  }

  private accept(doc: CvDocument): void {
    this.source.set(doc.latex);
    this.name.set(doc.name);
    this.saved.set({ source: doc.latex, name: doc.name });
  }

  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) {
      event.preventDefault();
    }
  }

  protected compile(): void {
    if (this.status()?.compiler) {
      this.compiler.run(this.source());
    }
  }

  protected save(): void {
    if (!this.dirty() || this.saving()) return;
    this.saving.set(true);
    this.saveChanges().subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.show('Saved.');
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  private saveChanges(): Observable<unknown> {
    const name = this.name().trim() || this.saved().name;
    const latex = this.source();
    if (!this.dirty()) return of(null);
    // Anything typed while the save is in flight stays marked as unsaved.
    return this.api
      .updateDocument(this.id(), { name, latex })
      .pipe(tap((doc) => this.saved.set({ source: doc.latex, name: doc.name })));
  }

  protected downloadPdf(): void {
    const pdf = this.compiler.pdf();
    if (pdf && this.pdfReady()) {
      saveFile(pdf, fileName(this.name(), 'pdf'));
    }
  }

  protected downloadWord(): void {
    this.makingWord.set(true);
    this.api.word(this.source(), this.name()).subscribe({
      next: (blob) => {
        this.makingWord.set(false);
        saveFile(blob, fileName(this.name(), 'docx'));
      },
      error: (err) => {
        this.makingWord.set(false);
        this.toast.error(errorMessage(err, "The Word file couldn't be made."));
      },
    });
  }

  protected openSnapshot(): void {
    const date = new Date().toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
    this.snapshotName = `${this.name().trim()}, ${date}`.slice(0, 120);
    this.snapshotOpen.set(true);
  }

  /** Saves the CV as it is now as an unchangeable PDF CV (saving any edits first). */
  protected snapshot(): void {
    const name = this.snapshotName.trim();
    if (!name) return;
    this.snapshotting.set(true);
    this.saveChanges()
      .pipe(switchMap(() => this.api.snapshot(this.id(), name)))
      .subscribe({
        next: () => {
          this.snapshotting.set(false);
          this.snapshotOpen.set(false);
          this.toast.show('Saved as a PDF CV. You can pick it as the CV sent for a job.');
        },
        error: (err) => {
          this.snapshotting.set(false);
          this.toast.error(errorMessage(err));
        },
      });
  }

  protected goToLine(line: number): void {
    this.editor()?.goToLine(line);
  }
}
