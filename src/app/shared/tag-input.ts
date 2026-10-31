import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** A list of short text values: type and press Enter (or comma) to add, Backspace to remove the last. */
@Component({
  selector: 'app-tag-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TagInput), multi: true }],
  template: `
    <div class="tags control" (click)="field.focus()">
      @for (tag of tags(); track tag; let i = $index) {
        <span class="tag">
          {{ tag }}
          <button type="button" (click)="remove(i); $event.stopPropagation()" [attr.aria-label]="'Remove ' + tag">
            ×
          </button>
        </span>
      }
      <input
        #field
        [id]="inputId()"
        [placeholder]="tags().length ? '' : placeholder()"
        [disabled]="disabled()"
        (keydown)="onKeydown($event, field)"
        (blur)="commit(field); onTouched()"
        maxlength="100"
        autocomplete="off"
      />
    </div>
  `,
  styles: `
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      cursor: text;
      padding: 6px 8px;
    }
    .tags:focus-within {
      border-color: var(--sign);
      box-shadow: 0 0 0 3px rgba(31, 79, 163, 0.18);
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 2px 4px 1px 10px;
      border-radius: 999px;
      background: var(--sign-wash);
      color: var(--sign-deep);
      font-weight: 650;
      font-size: 0.9rem;
    }
    .tag button {
      width: 22px;
      height: 22px;
      border: 0;
      border-radius: 50%;
      background: none;
      color: inherit;
      font-size: 1.05rem;
      line-height: 1;
      cursor: pointer;
    }
    .tag button:hover {
      background: rgba(31, 79, 163, 0.14);
    }
    input {
      flex: 1;
      min-width: 140px;
      border: 0;
      outline: none;
      padding: 4px;
      font: inherit;
      background: transparent;
      color: var(--ink);
    }
  `,
})
export class TagInput implements ControlValueAccessor {
  readonly placeholder = input('Type and press Enter');
  readonly inputId = input<string | null>(null);
  readonly max = input(25);

  protected readonly tags = signal<string[]>([]);
  protected readonly disabled = signal(false);
  private onChange: (value: string[]) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(value: string[] | null): void {
    this.tags.set(Array.isArray(value) ? [...value] : []);
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
  }

  protected onKeydown(event: KeyboardEvent, field: HTMLInputElement): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.commit(field);
    } else if (event.key === 'Backspace' && !field.value && this.tags().length) {
      this.remove(this.tags().length - 1);
    }
  }

  protected commit(field: HTMLInputElement): void {
    const value = field.value.trim().replace(/,$/, '');
    field.value = '';
    if (!value || this.tags().length >= this.max()) {
      return;
    }
    if (this.tags().some((tag) => tag.toLowerCase() === value.toLowerCase())) {
      return;
    }
    this.tags.update((tags) => [...tags, value]);
    this.onChange(this.tags());
  }

  protected remove(index: number): void {
    this.tags.update((tags) => tags.filter((_, i) => i !== index));
    this.onChange(this.tags());
  }
}
