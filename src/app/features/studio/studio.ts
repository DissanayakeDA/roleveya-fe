import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { CvsApi, StudioApi } from '../../core/api.service';
import { fileSize } from '../../core/format';
import { errorMessage } from '../../core/http';
import { Cv, CvDocumentSummary, CvVersionSummary, StudioStatus, TemplateId } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../shared/icon';
import { RoleTitlePipe } from '../../shared/role-title.pipe';

type StartMode = 'template' | 'paste' | 'convert';

const MAX_PDF_MB = 5;

@Component({
  selector: 'app-studio',
  imports: [DatePipe, FormsModule, RouterLink, Icon, RoleTitlePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './studio.html',
  styleUrl: './studio.scss',
})
export class Studio {
  private readonly api = inject(StudioApi);
  private readonly cvsApi = inject(CvsApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly status = signal<StudioStatus | null>(null);
  protected readonly documents = signal<CvDocumentSummary[]>([]);
  protected readonly versions = signal<CvVersionSummary[]>([]);
  protected readonly uploadedCvs = signal<Cv[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly confirmingDelete = signal<string | null>(null);

  protected readonly mode = signal<StartMode>('template');
  protected readonly working = signal(false);
  protected readonly startError = signal<string | null>(null);
  protected readonly pdf = signal<File | null>(null);
  protected readonly dragging = signal(false);
  protected readonly size = fileSize;
  protected readonly maxPdfMb = MAX_PDF_MB;

  protected name = 'Master CV';
  protected template: TemplateId = 'classic';
  protected pasted = '';
  /** "upload", or the id of one of the user's CVs. */
  protected convertFrom = 'upload';

  protected readonly templateNames = computed(
    () => new Map((this.status()?.templates ?? []).map((t) => [t.id, t.name] as [string, string])),
  );

  constructor() {
    forkJoin({
      status: this.api.status(),
      documents: this.api.documents(),
      versions: this.api.versions(),
      cvs: this.cvsApi.list(),
    }).subscribe({
      next: ({ status, documents, versions, cvs }) => {
        this.status.set(status);
        this.documents.set(documents);
        this.versions.set(versions);
        // Saved versions came from LaTeX already; converting them back would only lose layout.
        this.uploadedCvs.set(cvs.filter((cv) => !cv.version_id));
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(errorMessage(err, "The CV studio couldn't be loaded. Refresh to try again."));
      },
    });
  }

  protected setMode(mode: StartMode): void {
    this.mode.set(mode);
    this.startError.set(null);
  }

  protected onPick(input: HTMLInputElement): void {
    this.choosePdf(input.files?.[0] ?? null);
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.choosePdf(event.dataTransfer?.files?.[0] ?? null);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  private choosePdf(file: File | null): void {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      this.startError.set('Choose a PDF file.');
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      this.startError.set(`PDFs must be ${MAX_PDF_MB} MB or smaller.`);
      return;
    }
    this.startError.set(null);
    this.pdf.set(file);
  }

  protected start(): void {
    const name = this.name.trim() || 'Master CV';
    this.startError.set(null);
    const mode = this.mode();

    if (mode === 'paste' && !this.pasted.trim()) {
      this.startError.set('Paste your LaTeX first.');
      return;
    }
    let request;
    if (mode === 'template') {
      request = this.api.createDocument({ name, template: this.template });
    } else if (mode === 'paste') {
      request = this.api.createDocument({ name, latex: this.pasted });
    } else {
      const file = this.pdf();
      if (this.convertFrom === 'upload' && !file) {
        this.startError.set('Choose the PDF to convert.');
        return;
      }
      const source = this.convertFrom === 'upload' ? { file: file! } : { cvId: this.convertFrom };
      // The API names it after the PDF unless the name was changed.
      request = this.api.convertPdf(source, this.template, name === 'Master CV' ? null : name);
    }

    this.working.set(true);
    request.subscribe({
      next: (document) => {
        this.toast.show(mode === 'convert' ? 'Converted. Check it over before you use it.' : 'Master CV created.');
        this.router.navigate(['/studio', document.id]);
      },
      error: (err) => {
        this.working.set(false);
        this.startError.set(errorMessage(err));
      },
    });
  }

  protected remove(document: CvDocumentSummary): void {
    this.api.removeDocument(document.id).subscribe({
      next: () => {
        this.confirmingDelete.set(null);
        this.documents.update((list) => list.filter((item) => item.id !== document.id));
        this.toast.show('Master CV deleted.');
      },
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }

  protected startLabel(): string {
    if (this.working()) {
      return this.mode() === 'convert' ? 'Converting… (up to a minute)' : 'Creating…';
    }
    return this.mode() === 'convert' ? 'Convert to LaTeX' : 'Create master CV';
  }
}
