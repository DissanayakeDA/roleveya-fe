import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  show(text: string, tone: Toast['tone'] = 'info'): void {
    const toast = { id: this.nextId++, text, tone };
    this.toasts.update((list) => [...list.slice(-2), toast]);
    setTimeout(() => this.dismiss(toast.id), tone === 'error' ? 7000 : 4000);
  }

  error(text: string): void {
    this.show(text, 'error');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }
}
