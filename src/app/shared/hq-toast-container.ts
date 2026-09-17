import { Component, ViewEncapsulation, inject } from '@angular/core';
import { HqIcon } from './hq-icon';
import { HqToastService, HqToastType } from './hq-toast.service';

@Component({
  selector: 'app-hq-toast-container',
  imports: [HqIcon],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="hq-toast-stack" aria-live="polite" aria-relevant="additions removals">
      @for (toast of toasts.toasts(); track toast.id) {
        <article
          [class]="toastClass(toast.type, toast.exiting)"
          role="status"
        >
          <span class="hq-toast-dot" aria-hidden="true"></span>
          <div class="hq-toast-body">
            <strong>{{ toast.title }}</strong>
            <p>{{ toast.message }}</p>
          </div>
          <button
            class="hq-toast-close"
            type="button"
            aria-label="Dismiss notification"
            (mousedown)="$event.preventDefault()"
            (click)="toasts.dismiss(toast.id)"
          >
            <app-hq-icon name="x" [size]="14" />
          </button>
        </article>
      }
    </div>
  `,
})
export class HqToastContainer {
  readonly toasts = inject(HqToastService);

  toastClass(type: HqToastType, exiting?: boolean): string {
    const classes = ['hq-toast', `hq-toast-${type}`];
    if (exiting) classes.push('hq-toast-exit');
    return classes.join(' ');
  }
}
