import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type HqToastType = 'success' | 'error' | 'info' | 'warning';

export interface HqToast {
  id: string;
  type: HqToastType;
  title: string;
  message: string;
  exiting?: boolean;
}

const MAX_TOASTS = 2;
const EXIT_MS = 220;
const DEFAULT_DURATION_MS = 3800;

@Injectable({ providedIn: 'root' })
export class HqToastService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toastsSignal = signal<HqToast[]>([]);
  private nextId = 0;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly exitTimers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly toasts = this.toastsSignal.asReadonly();

  success(message: string, title = 'Saved'): void {
    this.show('success', message, title);
  }

  error(message: string, title = 'Something went wrong'): void {
    this.show('error', message, title);
  }

  info(message: string, title = 'Update'): void {
    this.show('info', message, title);
  }

  warning(message: string, title = 'Notice'): void {
    this.show('warning', message, title);
  }

  show(type: HqToastType, message: string, title: string, durationMs = DEFAULT_DURATION_MS): void {
    const id = `toast-${++this.nextId}`;
    const toast: HqToast = { id, type, title, message };

    this.toastsSignal.update((list) => {
      // Drop stale exit animations so rapid updates never stack upward.
      let next = list.filter((item) => !item.exiting);

      if (next.length >= MAX_TOASTS) {
        const oldest = next[0];
        this.clearTimer(oldest.id);
        next = [{ ...oldest, exiting: true }, ...next.slice(1)];
        this.scheduleRemoval(oldest.id);
      }

      return [...next, toast];
    });

    if (!isPlatformBrowser(this.platformId)) return;

    const timer = setTimeout(() => this.dismiss(id), durationMs);
    this.timers.set(id, timer);
  }

  dismiss(id: string): void {
    this.beginExit(id);
  }

  clear(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    for (const timer of this.exitTimers.values()) clearTimeout(timer);
    this.timers.clear();
    this.exitTimers.clear();
    this.toastsSignal.set([]);
  }

  private beginExit(id: string): void {
    const toast = this.toastsSignal().find((item) => item.id === id);
    if (!toast || toast.exiting) return;

    this.clearTimer(id);

    this.toastsSignal.update((list) =>
      list.map((item) => (item.id === id ? { ...item, exiting: true } : item)),
    );

    this.scheduleRemoval(id);
  }

  private scheduleRemoval(id: string): void {
    const existing = this.exitTimers.get(id);
    if (existing) clearTimeout(existing);

    if (!isPlatformBrowser(this.platformId)) {
      this.removeToast(id);
      return;
    }

    const exitTimer = setTimeout(() => this.removeToast(id), EXIT_MS);
    this.exitTimers.set(id, exitTimer);
  }

  private removeToast(id: string): void {
    this.clearTimer(id);
    const exitTimer = this.exitTimers.get(id);
    if (exitTimer) {
      clearTimeout(exitTimer);
      this.exitTimers.delete(id);
    }
    this.toastsSignal.update((list) => list.filter((toast) => toast.id !== id));
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
