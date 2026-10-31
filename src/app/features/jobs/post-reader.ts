import { ChangeDetectionStrategy, Component, DestroyRef, inject, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { JobsApi } from '../../core/api.service';
import { errorMessage } from '../../core/http';
import { ExtractedJob } from '../../core/models';
import { Icon } from '../../shared/icon';

const SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export interface PostRead {
  found: ExtractedJob;
  from: 'screenshot' | 'text';
}

/**
 * Fills the job form from a LinkedIn post: a screenshot (dropped, chosen, or pasted with Ctrl+V anywhere on
 * the page) or copied text. Lives inside the job form, so every button here is type="button".
 */
@Component({
  selector: 'app-post-reader',
  imports: [ReactiveFormsModule, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:paste)': 'pasteAnywhere($event)' },
  styleUrl: './post-reader.scss',
  template: `
    <div class="choices" role="radiogroup" aria-label="Fill the form from">
      <label>
        <input type="radio" name="post-source" [checked]="mode() === 'screenshot'" (change)="mode.set('screenshot')" />
        Screenshot
      </label>
      <label>
        <input type="radio" name="post-source" [checked]="mode() === 'text'" (change)="mode.set('text')" />
        Copied text
      </label>
    </div>

    @if (mode() === 'screenshot') {
      @if (shot(); as current) {
        <div class="shot">
          <img [src]="current.url" alt="The screenshot you added" />
          <div class="shot-info">
            <p class="file-name">{{ current.file.name }}</p>
            @if (busy()) {
              <p class="status" role="status">
                {{ slow() ? 'Still reading. The first screenshot takes longer while the reader starts.' : 'Reading the screenshot…' }}
              </p>
            }
            <label class="check">
              <input type="checkbox" [checked]="keep()" (change)="setKeep($event)" />
              Save it with the job as the poster
            </label>
            <button type="button" class="link-btn" (click)="clearShot()" [disabled]="busy()">Use a different screenshot</button>
          </div>
        </div>
      } @else {
        <div
          class="drop"
          [class.dragging]="dragging()"
          (dragover)="dragOver($event)"
          (dragleave)="dragging.set(false)"
          (drop)="drop($event)"
        >
          <app-icon name="upload" [size]="22" />
          <p><strong>Drop a screenshot of the post here</strong>, or press Ctrl+V to paste one.</p>
          <label class="btn btn-secondary btn-sm picker">
            Choose a screenshot
            <input #picker type="file" class="sr-only" accept="image/png,image/jpeg,image/webp" (change)="pick(picker)" />
          </label>
          <span class="hint">PNG, JPG or WebP, up to 5 MB.</span>
        </div>
      }
    } @else {
      <div class="field">
        <label for="post-text">Text from the post</label>
        <textarea
          id="post-text"
          class="control"
          rows="6"
          [formControl]="text"
          (paste)="pastedIntoBox()"
          placeholder="Paste the whole post, or just the company name and the description"
        ></textarea>
      </div>
      <div class="row">
        <button type="button" class="btn btn-secondary" (click)="readText()" [disabled]="busy() || !text.value.trim()">
          {{ busy() ? 'Reading…' : 'Fill in the form' }}
        </button>
        <span class="hint">Pasting into the box fills the form straight away.</span>
      </div>
    }

    @if (error()) {
      <p class="alert" role="alert">{{ error() }}</p>
    }
  `,
})
export class PostReader {
  private readonly jobs = inject(JobsApi);

  readonly read = output<PostRead>();
  /** The screenshot to save as the job's poster, or null when there's none or the user unticked it. */
  readonly keepScreenshot = output<File | null>();

  protected readonly mode = signal<'screenshot' | 'text'>('screenshot');
  protected readonly shot = signal<{ file: File; url: string } | null>(null);
  protected readonly keep = signal(true);
  protected readonly busy = signal(false);
  protected readonly slow = signal(false);
  protected readonly dragging = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly text = new FormControl('', { nonNullable: true });
  private slowTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.releasePreview();
      clearTimeout(this.slowTimer);
    });
  }

  /** Ctrl+V anywhere on the page: an image becomes the screenshot, text outside a field fills the box. */
  protected pasteAnywhere(event: ClipboardEvent): void {
    const data = event.clipboardData;
    const image = Array.from(data?.files ?? []).find((file) => file.type.startsWith('image/'));
    if (image) {
      event.preventDefault();
      this.mode.set('screenshot');
      this.useScreenshot(image);
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }
    const text = data?.getData('text/plain')?.trim() ?? '';
    if (text.length >= 20) {
      event.preventDefault();
      this.mode.set('text');
      this.text.setValue(text);
      this.readText();
    }
  }

  protected pick(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.useScreenshot(file);
    }
  }

  protected dragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.useScreenshot(file);
    }
  }

  protected setKeep(event: Event): void {
    this.keep.set((event.target as HTMLInputElement).checked);
    this.emitKeep();
  }

  protected clearShot(): void {
    this.releasePreview();
    this.shot.set(null);
    this.error.set(null);
    this.emitKeep();
  }

  /** Runs once the pasted text has landed in the box (the paste event fires before it does). */
  protected pastedIntoBox(): void {
    if (!this.text.value.trim()) {
      setTimeout(() => this.readText());
    }
  }

  protected readText(): void {
    const text = this.text.value.trim();
    if (text && !this.busy()) {
      this.run(this.jobs.extractFromText(text), 'text');
    }
  }

  private useScreenshot(file: File): void {
    if (this.busy()) {
      return;
    }
    if (file.type && !SCREENSHOT_TYPES.includes(file.type)) {
      this.error.set('Use a PNG, JPG or WebP screenshot.');
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      this.error.set('Screenshots must be 5 MB or smaller. Crop it to the post and try again.');
      return;
    }
    this.releasePreview();
    this.shot.set({ file, url: URL.createObjectURL(file) });
    this.emitKeep();
    this.run(this.jobs.extractFromScreenshot(file), 'screenshot');
  }

  private run(request: Observable<ExtractedJob>, from: PostRead['from']): void {
    this.busy.set(true);
    this.slow.set(false);
    this.error.set(null);
    this.slowTimer = setTimeout(() => this.slow.set(true), 8000);
    request.subscribe({
      next: (found) => {
        this.done();
        this.read.emit({ found, from });
      },
      error: (err) => {
        this.done();
        this.error.set(errorMessage(err, "That couldn't be read. Try again, or fill in the form yourself."));
      },
    });
  }

  private done(): void {
    clearTimeout(this.slowTimer);
    this.busy.set(false);
    this.slow.set(false);
  }

  private emitKeep(): void {
    const shot = this.shot();
    this.keepScreenshot.emit(shot && this.keep() ? shot.file : null);
  }

  private releasePreview(): void {
    const shot = this.shot();
    if (shot) {
      URL.revokeObjectURL(shot.url);
    }
  }
}
