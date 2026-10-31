import { ChangeDetectionStrategy, Component, ElementRef, computed, input, model, output, viewChild } from '@angular/core';

import { LatexIssue } from '../../core/models';

/**
 * A plain-text LaTeX editor with line numbers. Lines with compile errors are marked in the gutter.
 * Ctrl+S (or Cmd+S) emits `save`, Ctrl+Enter emits `compile`, and Tab indents instead of leaving the field.
 */
@Component({
  selector: 'app-latex-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editor" [class.readonly]="readonly()">
      <div class="gutter" aria-hidden="true" #gutter>
        @for (line of lines(); track line) {
          <span [class.bad]="badLines().has(line)">{{ line }}</span>
        }
      </div>
      <textarea
        #area
        class="code"
        [id]="inputId()"
        [attr.aria-label]="label()"
        [attr.aria-describedby]="describedBy() || null"
        [value]="value()"
        [readOnly]="readonly()"
        (input)="value.set(area.value)"
        (keydown)="onKey($event)"
        (scroll)="syncGutter()"
        wrap="off"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
      ></textarea>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 0;
    }
    .editor {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      height: 100%;
      border: 1px solid var(--keyline-strong);
      border-radius: var(--radius-control);
      background: var(--surface);
      overflow: hidden;
    }
    .editor:focus-within {
      border-color: var(--sign);
      box-shadow: 0 0 0 3px rgba(31, 79, 163, 0.18);
    }
    .editor.readonly {
      background: #fafbfc;
    }
    .gutter,
    .code {
      margin: 0;
      padding: 12px 0;
      font-family: 'Cascadia Mono', Consolas, 'SF Mono', Menlo, ui-monospace, monospace;
      font-size: 0.8125rem;
      line-height: 1.6;
    }
    .gutter {
      display: flex;
      flex-direction: column;
      min-width: 3.4em;
      padding-right: 10px;
      padding-left: 8px;
      /* Room to scroll as far as the text area can (its last line plus a scrollbar). */
      padding-bottom: 48px;
      overflow: hidden;
      border-right: 1px solid var(--keyline);
      background: var(--paper);
      color: var(--ink-3);
      text-align: right;
      user-select: none;
    }
    .gutter span {
      display: block;
      height: 1.6em;
      font-variant-numeric: tabular-nums;
    }
    .gutter span.bad {
      margin-right: -10px;
      padding-right: 7px;
      border-right: 3px solid var(--loss);
      background: var(--loss-wash);
      color: var(--loss);
      font-weight: 700;
    }
    .code {
      width: 100%;
      height: 100%;
      padding-left: 12px;
      padding-right: 12px;
      border: 0;
      outline: none;
      resize: none;
      background: transparent;
      color: var(--ink);
      tab-size: 2;
      white-space: pre;
      overflow: auto;
    }
  `,
})
export class LatexEditor {
  readonly value = model('');
  readonly issues = input<LatexIssue[]>([]);
  readonly readonly = input(false);
  readonly label = input('LaTeX source');
  readonly inputId = input('latex-source');
  readonly describedBy = input('');
  readonly save = output<void>();
  readonly compile = output<void>();

  private readonly area = viewChild.required<ElementRef<HTMLTextAreaElement>>('area');
  private readonly gutter = viewChild.required<ElementRef<HTMLDivElement>>('gutter');

  protected readonly lines = computed(() => {
    const count = this.value().split('\n').length;
    return Array.from({ length: count }, (_, index) => index + 1);
  });
  protected readonly badLines = computed(
    () => new Set(this.issues().flatMap((issue) => (issue.line === null ? [] : [issue.line]))),
  );

  /** Moves the cursor to a line, selects it and scrolls it into view. */
  goToLine(line: number): void {
    const area = this.area().nativeElement;
    const text = area.value;
    let start = 0;
    for (let current = 1; current < line && start >= 0; current++) {
      start = text.indexOf('\n', start) + 1 || -1;
    }
    if (start < 0) return;
    const end = text.indexOf('\n', start);
    area.focus();
    area.setSelectionRange(start, end < 0 ? text.length : end);
    const lineHeight = parseFloat(getComputedStyle(area).lineHeight) || 20;
    area.scrollTop = Math.max(0, (line - 1) * lineHeight - area.clientHeight / 3);
    this.syncGutter();
  }

  /** Scrolls a line to the top without moving the cursor. */
  revealLine(line: number): void {
    const area = this.area().nativeElement;
    const lineHeight = parseFloat(getComputedStyle(area).lineHeight) || 20;
    area.scrollTop = Math.max(0, (line - 2) * lineHeight);
    this.syncGutter();
  }

  /** Selects a range of the text (used after a suggestion is applied) and scrolls to it. */
  select(start: number, end: number): void {
    const area = this.area().nativeElement;
    // Selection only moves the view when the field has focus, so scroll by the line instead.
    const line = area.value.slice(0, start).split('\n').length;
    this.goToLine(line);
    area.setSelectionRange(start, end);
  }

  protected syncGutter(): void {
    this.gutter().nativeElement.scrollTop = this.area().nativeElement.scrollTop;
  }

  protected onKey(event: KeyboardEvent): void {
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.save.emit();
    } else if (mod && event.key === 'Enter') {
      event.preventDefault();
      this.compile.emit();
    } else if (event.key === 'Tab' && !event.shiftKey && !mod && !this.readonly()) {
      event.preventDefault();
      // execCommand keeps the browser's undo history; setRangeText is the fallback.
      if (!document.execCommand('insertText', false, '  ')) {
        const area = this.area().nativeElement;
        area.setRangeText('  ', area.selectionStart, area.selectionEnd, 'end');
        this.value.set(area.value);
      }
    }
  }
}
