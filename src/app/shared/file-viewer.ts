import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Observable } from 'rxjs';

import { errorMessage } from '../core/http';
import { Icon } from './icon';

/**
 * Shows a private file (CV or job poster) in a modal. The file is fetched through the API as a blob and
 * displayed from a local object URL, so no storage URL is ever exposed to the page.
 */
@Component({
  selector: 'app-file-viewer',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialog (close)="cleanup()" (click)="onBackdrop($event)" [attr.aria-label]="title()">
      <header>
        <h2>{{ title() }}</h2>
        <div class="actions">
          @if (url()) {
            <a class="btn btn-secondary btn-sm" [href]="safeDownload()" [attr.download]="filename()">Download</a>
          }
          <button type="button" class="btn btn-ghost btn-sm" (click)="close()" aria-label="Close">
            <app-icon name="close" />
          </button>
        </div>
      </header>
      <div class="body">
        @if (error()) {
          <p class="alert">{{ error() }}</p>
        } @else if (!url()) {
          <p class="muted">Opening file…</p>
        } @else if (kind() === 'pdf') {
          <iframe [src]="safeFrame()" [title]="title()"></iframe>
        } @else {
          <img [src]="safeDownload()" [alt]="title()" />
        }
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      width: min(960px, calc(100vw - 32px));
      height: min(88vh, 1100px);
      padding: 0;
      border: 0;
      border-radius: var(--radius-panel);
      background: var(--surface);
      color: var(--ink);
    }
    dialog[open] {
      display: flex;
      flex-direction: column;
    }
    dialog::backdrop {
      background: rgba(22, 35, 59, 0.55);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 12px 12px 20px;
      border-bottom: 1px solid var(--keyline);
    }
    h2 {
      font-size: 1.05rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .actions {
      display: flex;
      gap: 6px;
    }
    .body {
      flex: 1;
      display: grid;
      place-items: center;
      min-height: 0;
      background: var(--paper);
      padding: 0;
    }
    .body > p {
      margin: 24px;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
    }
    img {
      max-height: 100%;
      object-fit: contain;
      padding: 16px;
    }
  `,
})
export class FileViewer implements OnDestroy {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly title = signal('');
  protected readonly filename = signal('');
  protected readonly kind = signal<'pdf' | 'image'>('pdf');
  protected readonly url = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  // Object URLs are created here from bytes the API returned, so trusting them is safe.
  protected readonly safeFrame = computed(() => {
    const url = this.url();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  protected readonly safeDownload = computed(() => {
    const url = this.url();
    return url ? this.sanitizer.bypassSecurityTrustUrl(url) : null;
  });

  open(options: { title: string; filename: string; kind: 'pdf' | 'image'; load: Observable<Blob> }): void {
    this.cleanup();
    this.title.set(options.title);
    this.filename.set(options.filename);
    this.kind.set(options.kind);
    this.dialog().nativeElement.showModal();
    options.load.subscribe({
      next: (blob) => this.url.set(URL.createObjectURL(blob)),
      error: (err) => this.error.set(errorMessage(err, 'This file could not be opened. Try again.')),
    });
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.close();
    }
  }

  protected cleanup(): void {
    const url = this.url();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.url.set(null);
    this.error.set(null);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
