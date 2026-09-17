import { Component, computed, inject, input, output } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'app-hq-pagination',
  template: `
    @if (totalPages() > 1) {
      <div class="hq-pagination">
        <span class="meta">{{ rangeLabel() }}</span>
        <div class="controls">
          <button
            class="page-btn"
            type="button"
            [disabled]="page() <= 1"
            (mousedown)="$event.preventDefault()"
            (click)="selectPage(page() - 1, $event)"
          >
            Previous
          </button>
          @for (p of visiblePages(); track p) {
            <button
              class="page-btn"
              type="button"
              [class.active]="p === page()"
              (mousedown)="$event.preventDefault()"
              (click)="selectPage(p, $event)"
            >
              {{ p }}
            </button>
          }
          <button
            class="page-btn"
            type="button"
            [disabled]="page() >= totalPages()"
            (mousedown)="$event.preventDefault()"
            (click)="selectPage(page() + 1, $event)"
          >
            Next
          </button>
        </div>
      </div>
    }
  `,
  styles: `
    .hq-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.85rem 1rem;
      border-top: 1px solid var(--hq-glass-border);
      flex-wrap: wrap;
    }

    .meta {
      font-size: 0.78rem;
      color: var(--hq-text-muted);
    }

    .controls {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      min-width: 15.5rem;
      justify-content: flex-end;
    }

    .page-btn {
      min-width: 2rem;
      padding: 0.35rem 0.65rem;
      border: 1px solid var(--hq-glass-border);
      border-radius: var(--hq-radius-pill);
      background: rgba(255, 255, 255, 0.72);
      color: var(--hq-text);
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
    }

    .page-btn:hover:not(:disabled) {
      border-color: #93c5fd;
      background: rgba(219, 234, 254, 0.5);
    }

    .page-btn.active {
      border-color: var(--hq-primary);
      background: var(--hq-primary-soft);
      color: var(--hq-primary);
    }

    .page-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    @media (max-width: 640px) {
      .hq-pagination {
        flex-direction: column;
        align-items: stretch;
      }

      .controls {
        min-width: 0;
        width: 100%;
        justify-content: space-between;
        flex-wrap: wrap;
      }

      .page-btn {
        flex: 1 1 auto;
      }
    }
  `,
})
export class HqPagination {
  private readonly platformId = inject(PLATFORM_ID);

  readonly page = input.required<number>();
  readonly pageSize = input(10);
  readonly total = input.required<number>();
  readonly pageChange = output<number>();

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly rangeLabel = computed(() => {
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(this.page() * this.pageSize(), this.total());
    return `${start}–${end} of ${this.total()}`;
  });

  readonly visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    const windowSize = 5;

    if (total <= windowSize) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    let start = Math.max(1, current - 2);
    const end = Math.min(total, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  });

  selectPage(nextPage: number, event: MouseEvent): void {
    event.preventDefault();

    if (nextPage < 1 || nextPage > this.totalPages() || nextPage === this.page()) {
      return;
    }

    const scrollX = isPlatformBrowser(this.platformId) ? window.scrollX : 0;
    const scrollY = isPlatformBrowser(this.platformId) ? window.scrollY : 0;

    this.pageChange.emit(nextPage);

    if (!isPlatformBrowser(this.platformId)) return;

    requestAnimationFrame(() => {
      window.scrollTo(scrollX, scrollY);
      requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
    });
  }
}
