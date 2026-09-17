import {
  afterNextRender,
  ApplicationRef,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  input,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { isPlatformBrowser, NgClass } from '@angular/common';

@Component({
  selector: 'app-hq-page-tabs',
  imports: [NgClass],
  template: `
    <div class="page-tabs" [ngClass]="tabsClass()" role="tablist" (click)="onTabsClick()">
      <span
        class="page-tabs-indicator"
        [class.ready]="indicatorReady()"
        aria-hidden="true"
      ></span>
      <ng-content />
    </div>
  `,
  styleUrl: './hq-page-tabs.scss',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'hq-page-tabs-host',
  },
})
export class HqPageTabs implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly appRef = inject(ApplicationRef);
  private readonly root = inject(ElementRef<HTMLElement>);

  readonly tabsClass = input('', { alias: 'tabsClass' });
  readonly indicatorReady = signal(false);

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private syncFrame?: number;
  private hasPositioned = false;

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      this.initObservers();
      this.deferSync(true);
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    if (this.syncFrame) cancelAnimationFrame(this.syncFrame);
  }

  onTabsClick(): void {
    void this.appRef.whenStable().then(() => this.deferSync());
  }

  private initObservers(): void {
    const hostEl = this.tabsHost();
    if (!hostEl) return;

    this.resizeObserver = new ResizeObserver(() => this.deferSync());
    this.resizeObserver.observe(hostEl);

    this.mutationObserver = new MutationObserver((mutations) => {
      const shouldSync = mutations.some((mutation) => {
        const target = mutation.target as HTMLElement;
        return !target.classList.contains('page-tabs-indicator');
      });
      if (shouldSync) this.deferSync();
    });

    this.mutationObserver.observe(hostEl, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
    });
  }

  private deferSync(initial = false): void {
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.syncFrame) cancelAnimationFrame(this.syncFrame);

    this.ngZone.runOutsideAngular(() => {
      queueMicrotask(() => {
        this.syncIndicator(initial);
        this.syncFrame = requestAnimationFrame(() => {
          this.syncIndicator(false);
          this.syncFrame = requestAnimationFrame(() => this.syncIndicator(false));
        });
      });
    });
  }

  private tabsHost(): HTMLElement | null {
    return this.root.nativeElement.querySelector('.page-tabs');
  }

  private tabsIndicator(): HTMLElement | null {
    return this.root.nativeElement.querySelector('.page-tabs-indicator');
  }

  private syncIndicator(initial: boolean): void {
    const hostEl = this.tabsHost();
    const indicatorEl = this.tabsIndicator();
    if (!hostEl || !indicatorEl) return;

    const active = hostEl.querySelector<HTMLElement>('button.active');
    if (!active) {
      indicatorEl.style.opacity = '0';
      this.indicatorReady.set(false);
      this.hasPositioned = false;
      return;
    }

    const hostRect = hostEl.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();

    if (initial && !this.hasPositioned) {
      indicatorEl.classList.add('instant');
    }

    indicatorEl.style.width = `${activeRect.width}px`;
    indicatorEl.style.height = `${activeRect.height}px`;
    indicatorEl.style.transform = `translate(${activeRect.left - hostRect.left}px, ${activeRect.top - hostRect.top}px)`;
    indicatorEl.style.opacity = '1';
    this.indicatorReady.set(true);
    this.hasPositioned = true;
    this.cdr.markForCheck();

    if (initial && indicatorEl.classList.contains('instant')) {
      requestAnimationFrame(() => indicatorEl.classList.remove('instant'));
    }
  }
}
