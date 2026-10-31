import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService } from '../core/toast.service';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack" aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast" [class.error]="toast.tone === 'error'" [attr.role]="toast.tone === 'error' ? 'alert' : 'status'">
          <span>{{ toast.text }}</span>
          <button type="button" (click)="toasts.dismiss(toast.id)" aria-label="Dismiss">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .stack {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 50;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-width: min(380px, calc(100vw - 40px));
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 10px 12px 16px;
      border-radius: var(--radius-control);
      background: var(--ink);
      color: #fff;
      font-weight: 600;
      font-size: 0.95rem;
      box-shadow: 0 8px 24px rgba(22, 35, 59, 0.22);
      animation: rise 160ms ease-out;
    }
    .toast.error {
      background: var(--loss);
    }
    span {
      flex: 1;
    }
    button {
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      font-size: 1.2rem;
      cursor: pointer;
    }
    button:hover {
      background: rgba(255, 255, 255, 0.14);
    }
    @keyframes rise {
      from {
        transform: translateY(6px);
        opacity: 0;
      }
    }
  `,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);
}
