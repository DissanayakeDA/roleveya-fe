import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { LatexIssue } from '../../core/models';
import { CompileStatus } from './compile-state';

/** The PDF preview next to the editor, with compile errors listed above it. */
@Component({
  selector: 'app-pdf-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pane">
      @if (status() === 'failed' && issues().length) {
        <div class="issues" role="alert">
          <p><strong>It didn't compile.</strong> Fix {{ issues().length === 1 ? 'this' : 'these' }} and compile again.</p>
          <ul>
            @for (issue of issues(); track $index) {
              <li>
                @if (issue.line !== null) {
                  <button type="button" class="link-btn" (click)="lineClick.emit(issue.line)">Line {{ issue.line }}</button>
                }
                <span>{{ issue.message }}</span>
              </li>
            }
          </ul>
        </div>
      }
      <div class="paper" [class.dim]="stale() || status() === 'compiling'">
        @if (safeUrl(); as url) {
          <iframe [src]="url" title="PDF preview"></iframe>
          @if (stale() && status() !== 'compiling') {
            <p class="note">The preview is behind your edits. Compile to update it.</p>
          }
        } @else {
          <p class="placeholder">
            @if (status() === 'compiling') {
              Compiling… The first compile of a template can take a minute while its LaTeX packages download.
            } @else {
              {{ emptyText() }}
            }
          </p>
        }
        @if (status() === 'compiling' && safeUrl()) {
          <p class="note">Compiling…</p>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 0;
    }
    .pane {
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
    }
    .issues {
      padding: 12px 14px;
      border-radius: var(--radius-control);
      background: var(--loss-wash);
      color: var(--loss);
      font-size: 0.9rem;
    }
    .issues ul {
      display: grid;
      gap: 4px;
      margin: 8px 0 0;
      padding: 0;
      list-style: none;
      max-height: 140px;
      overflow: auto;
    }
    .issues li {
      display: flex;
      gap: 10px;
      overflow-wrap: anywhere;
    }
    .issues .link-btn {
      flex: none;
      color: var(--loss);
    }
    .paper {
      position: relative;
      flex: 1;
      min-height: 420px;
      border: 1px solid var(--keyline);
      border-radius: var(--radius-control);
      background: #e9ecf1;
      overflow: hidden;
    }
    .paper.dim iframe {
      opacity: 0.55;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      transition: opacity 120ms ease;
    }
    .placeholder {
      display: grid;
      place-items: center;
      height: 100%;
      padding: 32px;
      color: var(--ink-3);
      text-align: center;
    }
    .note {
      position: absolute;
      left: 50%;
      bottom: 16px;
      transform: translateX(-50%);
      padding: 7px 14px;
      border-radius: 999px;
      background: var(--ink);
      color: #fff;
      font-size: 0.85rem;
      font-weight: 650;
      white-space: nowrap;
    }
  `,
})
export class PdfPane {
  private readonly sanitizer = inject(DomSanitizer);

  readonly url = input<string | null>(null);
  readonly status = input<CompileStatus>('idle');
  readonly issues = input<LatexIssue[]>([]);
  /** True when the editor has changed since the PDF was made. */
  readonly stale = input(false);
  readonly emptyText = input('Compile to see your CV here.');
  readonly lineClick = output<number>();

  // Object URLs created from bytes the API returned, so trusting them is safe.
  protected readonly safeUrl = computed(() => {
    const url = this.url();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
}
