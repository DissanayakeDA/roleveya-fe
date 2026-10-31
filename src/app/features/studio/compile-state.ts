import { DestroyRef, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { StudioApi } from '../../core/api.service';
import { errorMessage } from '../../core/http';
import { LatexIssue } from '../../core/models';

export type CompileStatus = 'idle' | 'compiling' | 'ok' | 'failed';

/**
 * Compiles LaTeX through the API and keeps the latest PDF as a local object URL. Create it in a
 * component's field initialiser (it needs an injection context); the URL is released on destroy.
 */
export class CompileState {
  private readonly api = inject(StudioApi);
  private subscription?: Subscription;
  private blob: Blob | null = null;

  readonly status = signal<CompileStatus>('idle');
  readonly issues = signal<LatexIssue[]>([]);
  readonly pdfUrl = signal<string | null>(null);
  /** The source the shown PDF was made from. */
  readonly compiledSource = signal<string | null>(null);
  readonly busy = computed(() => this.status() === 'compiling');

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.subscription?.unsubscribe();
      this.setPdf(null);
    });
  }

  run(source: string): void {
    this.subscription?.unsubscribe();
    this.status.set('compiling');
    this.subscription = this.api.compile(source).subscribe({
      next: (result) => {
        if (result.ok && result.pdf_base64) {
          this.setPdf(toPdfBlob(result.pdf_base64));
          this.compiledSource.set(source);
          this.issues.set([]);
          this.status.set('ok');
        } else {
          this.issues.set(result.issues);
          this.status.set('failed');
        }
      },
      error: (err) => {
        this.issues.set([{ line: null, message: errorMessage(err, "The CV couldn't be compiled. Try again.") }]);
        this.status.set('failed');
      },
    });
  }

  /** Shows a PDF that's already been made (a saved version), without compiling. */
  show(blob: Blob, source: string): void {
    this.setPdf(blob);
    this.compiledSource.set(source);
    this.status.set('ok');
  }

  isCurrent(source: string): boolean {
    return this.compiledSource() === source && this.pdfUrl() !== null;
  }

  pdf(): Blob | null {
    return this.blob;
  }

  private setPdf(blob: Blob | null): void {
    const previous = this.pdfUrl();
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    this.blob = blob;
    this.pdfUrl.set(blob ? URL.createObjectURL(blob) : null);
  }
}

function toPdfBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: 'application/pdf' });
}
