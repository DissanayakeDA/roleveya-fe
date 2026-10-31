import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { CvsApi } from '../../core/api.service';
import { fileSize } from '../../core/format';
import { errorMessage } from '../../core/http';
import { Cv } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { FileViewer } from '../../shared/file-viewer';
import { Icon } from '../../shared/icon';

const MAX_MB = 5;

@Component({
  selector: 'app-cvs',
  imports: [DatePipe, FormsModule, RouterLink, FileViewer, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cvs.html',
  styleUrl: './cvs.scss',
})
export class Cvs {
  private readonly api = inject(CvsApi);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly viewer = viewChild.required(FileViewer);

  protected readonly cvs = signal<Cv[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly dragging = signal(false);
  protected readonly selected = signal<File | null>(null);
  protected readonly renaming = signal<string | null>(null);
  protected readonly confirmingDelete = signal<string | null>(null);
  protected readonly maxMb = MAX_MB;
  protected readonly size = fileSize;
  protected label = '';
  protected renameValue = '';

  constructor() {
    this.api.list().subscribe({
      next: (cvs) => {
        this.cvs.set(cvs);
        this.loading.set(false);
        const open = this.route.snapshot.queryParamMap.get('open');
        const target = open ? cvs.find((cv) => cv.id === open) : undefined;
        if (target) {
          queueMicrotask(() => this.view(target));
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(errorMessage(err, "Your CVs couldn't be loaded. Refresh to try again."));
      },
    });
  }

  protected onPick(input: HTMLInputElement): void {
    this.choose(input.files?.[0] ?? null);
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.choose(event.dataTransfer?.files?.[0] ?? null);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  private choose(file: File | null): void {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      this.toast.error('CVs must be PDF files.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      this.toast.error(`CVs must be ${MAX_MB} MB or smaller.`);
      return;
    }
    this.selected.set(file);
    if (!this.label) {
      this.label = file.name.replace(/\.pdf$/i, '').slice(0, 120);
    }
  }

  protected clearSelection(): void {
    this.selected.set(null);
    this.label = '';
  }

  protected upload(): void {
    const file = this.selected();
    if (!file) return;
    this.uploading.set(true);
    this.api.upload(file, this.label.trim() || null).subscribe({
      next: (cv) => {
        this.uploading.set(false);
        this.clearSelection();
        this.cvs.update((list) => this.sorted([cv, ...list]));
        this.toast.show('CV uploaded.');
      },
      error: (err) => {
        this.uploading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected view(cv: Cv): void {
    this.viewer().open({ title: cv.label, filename: cv.original_filename, kind: 'pdf', load: this.api.file(cv.id) });
  }

  protected makeDefault(cv: Cv): void {
    this.api.update(cv.id, { is_default: true }).subscribe({
      next: () => {
        this.cvs.update((list) => this.sorted(list.map((item) => ({ ...item, is_default: item.id === cv.id }))));
        this.toast.show(`${cv.label} is now your default CV.`);
      },
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }

  protected startRename(cv: Cv): void {
    this.renameValue = cv.label;
    this.renaming.set(cv.id);
  }

  protected saveRename(cv: Cv): void {
    const label = this.renameValue.trim();
    if (!label || label === cv.label) {
      this.renaming.set(null);
      return;
    }
    this.api.update(cv.id, { label }).subscribe({
      next: (updated) => {
        this.renaming.set(null);
        this.cvs.update((list) => list.map((item) => (item.id === cv.id ? updated : item)));
      },
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }

  protected remove(cv: Cv): void {
    this.api.remove(cv.id).subscribe({
      next: () => {
        this.confirmingDelete.set(null);
        // The API promotes the newest remaining CV when the default is deleted; reload to reflect it.
        this.api.list().subscribe({ next: (cvs) => this.cvs.set(cvs) });
        this.toast.show('CV deleted.');
      },
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }

  private sorted(list: Cv[]): Cv[] {
    return [...list].sort(
      (a, b) => Number(b.is_default) - Number(a.is_default) || b.created_at.localeCompare(a.created_at),
    );
  }
}
