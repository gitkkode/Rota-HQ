import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  PLATFORM_ID,
  ViewEncapsulation,
  afterEveryRender,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  portalToOverlay,
  removeFromOverlay,
  resetAnchoredPopover,
  syncAnchoredPopover,
} from './hq-overlay';
import { HqPopoverCoordinator } from './hq-popover-coordinator.service';
import { HqIcon } from './hq-icon';

export interface HqDateRange {
  start: string;
  end: string;
}

interface CalendarDay {
  date: Date;
  iso: string;
  inMonth: boolean;
  disabled: boolean;
}

let nextDateRangePickerId = 0;

@Component({
  selector: 'app-hq-date-range-picker',
  imports: [HqIcon],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="hq-date-range-wrap" [class.open]="open()" [class.active]="active()">
      <button
        type="button"
        class="hq-date-range-trigger"
        (mousedown)="$event.preventDefault()"
        (click)="toggle($event)"
        [attr.aria-expanded]="open()"
        aria-haspopup="dialog"
        [attr.aria-label]="ariaLabel()"
      >
        <app-hq-icon name="calendar" [size]="14" />
      </button>
      @if (open()) {
        <div
          #panelEl
          class="hq-popover hq-date-range-popover"
          role="dialog"
          aria-label="Custom date range"
          [attr.data-hq-date-range-id]="pickerId"
          (click)="$event.stopPropagation()"
        >
          <div class="hq-popover-head">
            <strong>Custom range</strong>
            <span>Select start and end dates</span>
          </div>

          <div class="hq-date-range-tabs">
            <button
              type="button"
              class="hq-date-range-tab"
              [class.active]="activeField() === 'start'"
              (click)="setActiveField('start')"
            >
              <span>From</span>
              <strong>{{ formatDisplay(draftStart()) }}</strong>
            </button>
            <button
              type="button"
              class="hq-date-range-tab"
              [class.active]="activeField() === 'end'"
              (click)="setActiveField('end')"
            >
              <span>To</span>
              <strong>{{ formatDisplay(draftEnd()) }}</strong>
            </button>
          </div>

          <div class="hq-date-calendar">
            <div class="hq-date-calendar-nav">
              <button type="button" class="hq-date-calendar-nav-btn" aria-label="Previous month" (click)="prevMonth()">
                <app-hq-icon name="chevron-left" [size]="14" />
              </button>
              <span class="hq-date-calendar-title">{{ monthLabel() }}</span>
              <button type="button" class="hq-date-calendar-nav-btn" aria-label="Next month" (click)="nextMonth()">
                <app-hq-icon name="chevron-right" [size]="14" />
              </button>
            </div>

            <div class="hq-date-calendar-weekdays" aria-hidden="true">
              @for (label of weekdayLabels; track label) {
                <span>{{ label }}</span>
              }
            </div>

            <div class="hq-date-calendar-grid" role="grid">
              @for (day of calendarDays(); track day.iso) {
                <button
                  type="button"
                  class="hq-date-calendar-day"
                  role="gridcell"
                  [class.out-month]="!day.inMonth"
                  [class.disabled]="day.disabled"
                  [class.selected]="isSelected(day)"
                  [class.range-start]="isRangeStart(day)"
                  [class.range-end]="isRangeEnd(day)"
                  [class.in-range]="isInRange(day)"
                  [disabled]="day.disabled"
                  (click)="selectDay(day)"
                >
                  {{ day.date.getDate() }}
                </button>
              }
            </div>
          </div>

          @if (error()) {
            <p class="hq-date-range-error">{{ error() }}</p>
          }

          <div class="hq-date-range-actions">
            <button type="button" class="hq-date-range-btn ghost" (click)="clear()">Clear</button>
            <button type="button" class="hq-date-range-btn primary" (click)="apply()">Apply</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class HqDateRangePicker {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly coordinator = inject(HqPopoverCoordinator);
  private readonly boundClose = (): void => this.forceClose();
  readonly pickerId = `hq-date-range-${++nextDateRangePickerId}`;
  private activePanel: HTMLElement | null = null;

  readonly panelEl = viewChild<ElementRef<HTMLElement>>('panelEl');

  readonly weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  readonly startDate = input('');
  readonly endDate = input('');
  readonly maxDate = input<string | null>(null);
  readonly active = input(false);
  readonly ariaLabel = input('Choose custom date range');
  readonly rangeChange = output<HqDateRange>();
  readonly cleared = output<void>();
  readonly opened = output<void>();

  readonly open = signal(false);
  readonly draftStart = signal('');
  readonly draftEnd = signal('');
  readonly error = signal('');
  readonly activeField = signal<'start' | 'end'>('start');
  readonly viewMonth = signal({ year: 2026, month: 7 });

  readonly monthLabel = computed(() => {
    const { year, month } = this.viewMonth();
    return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  readonly calendarDays = computed<CalendarDay[]>(() => {
    const { year, month } = this.viewMonth();
    const first = new Date(year, month, 1);
    const leading = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: CalendarDay[] = [];

    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = leading - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLast - i);
      cells.push(this.toCalendarDay(date, false));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      cells.push(this.toCalendarDay(date, true));
    }

    let nextDay = 1;
    while (cells.length % 7 !== 0) {
      const date = new Date(year, month + 1, nextDay++);
      cells.push(this.toCalendarDay(date, false));
    }

    return cells;
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        if (!this.open()) return;
        afterNextRender(() => this.syncPanel(), { injector: this.injector });
      });

      afterEveryRender(() => {
        if (this.open()) this.ensurePortaled();
      }, { injector: this.injector });

      const reposition = (): void => {
        if (this.open()) this.syncPanelPosition();
      };
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', reposition, true);
        window.removeEventListener('resize', reposition);
        this.teardownPanel();
      });
    } else {
      this.destroyRef.onDestroy(() => this.open.set(false));
    }
  }

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    if (this.open()) {
      this.close();
      return;
    }
    this.draftStart.set(this.startDate());
    this.draftEnd.set(this.endDate());
    this.activeField.set('start');
    this.error.set('');
    this.syncViewMonth(this.draftStart() || this.startDate());
    this.coordinator.requestPanelOpenExclusive(this.boundClose);
    this.open.set(true);
    this.opened.emit();
  }

  setActiveField(field: 'start' | 'end'): void {
    this.activeField.set(field);
    const iso = field === 'start' ? this.draftStart() : this.draftEnd();
    if (iso) this.syncViewMonth(iso);
  }

  prevMonth(): void {
    const { year, month } = this.viewMonth();
    const date = new Date(year, month - 1, 1);
    this.viewMonth.set({ year: date.getFullYear(), month: date.getMonth() });
  }

  nextMonth(): void {
    const { year, month } = this.viewMonth();
    const date = new Date(year, month + 1, 1);
    this.viewMonth.set({ year: date.getFullYear(), month: date.getMonth() });
  }

  selectDay(day: CalendarDay): void {
    if (day.disabled) return;
    this.error.set('');

    if (this.activeField() === 'start') {
      this.draftStart.set(day.iso);
      if (!this.draftEnd() || day.iso > this.draftEnd()) {
        this.draftEnd.set(day.iso);
      }
      this.activeField.set('end');
      return;
    }

    this.draftEnd.set(day.iso);
    if (this.draftStart() && day.iso < this.draftStart()) {
      this.draftStart.set(day.iso);
    }
    this.activeField.set('start');
  }

  isSelected(day: CalendarDay): boolean {
    return day.iso === this.draftStart() || day.iso === this.draftEnd();
  }

  isRangeStart(day: CalendarDay): boolean {
    return !!this.draftStart() && day.iso === this.draftStart();
  }

  isRangeEnd(day: CalendarDay): boolean {
    return !!this.draftEnd() && day.iso === this.draftEnd();
  }

  isInRange(day: CalendarDay): boolean {
    const start = this.draftStart();
    const end = this.draftEnd();
    if (!start || !end || start === end) return false;
    return day.iso > start && day.iso < end;
  }

  formatDisplay(iso: string): string {
    if (!iso) return 'Select date';
    const date = this.parseIso(iso);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  apply(): void {
    const start = this.draftStart();
    const end = this.draftEnd();
    if (!start || !end) {
      this.error.set('Select both start and end dates.');
      return;
    }
    if (start > end) {
      this.error.set('Start date must be before end date.');
      return;
    }
    this.rangeChange.emit({ start, end });
    this.close();
  }

  clear(): void {
    this.draftStart.set('');
    this.draftEnd.set('');
    this.error.set('');
    this.cleared.emit();
    this.close();
  }

  close(): void {
    this.forceClose();
  }

  forceClose(): void {
    const wasOpen = this.open();
    this.reparentPanelToHost();
    this.open.set(false);
    this.activePanel = null;
    if (wasOpen) {
      this.coordinator.notifyPanelClosed(this.boundClose);
    }
    this.purgeOwnedPanels();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!isPlatformBrowser(this.platformId) || !this.open()) return;
    const target = event.target as Node;
    if (this.el.nativeElement.contains(target)) return;
    const panel = this.panelEl()?.nativeElement ?? this.activePanel;
    if (panel?.contains(target)) return;
    this.close();
  }

  private toCalendarDay(date: Date, inMonth: boolean): CalendarDay {
    const iso = this.toIso(date);
    const max = this.maxDate();
    const disabled = !!max && iso > max;
    return { date, iso, inMonth, disabled };
  }

  private syncViewMonth(iso: string): void {
    const date = this.parseIso(iso);
    this.viewMonth.set({ year: date.getFullYear(), month: date.getMonth() });
  }

  private toIso(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseIso(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private ensurePortaled(): void {
    const panel = this.panelEl()?.nativeElement;
    if (!panel) return;
    this.activePanel = panel;
    portalToOverlay(panel);
  }

  private syncPanel(): void {
    this.syncPanelPosition();
  }

  private syncPanelPosition(): void {
    const panel = this.panelEl()?.nativeElement;
    const anchor =
      (this.el.nativeElement.closest('.hq-date-filter-group') as HTMLElement | null) ??
      (this.el.nativeElement.querySelector('.hq-date-range-trigger') as HTMLElement | null);
    if (!panel || !anchor) return;
    this.activePanel = panel;
    portalToOverlay(panel);
    syncAnchoredPopover(anchor, panel, {
      minWidth: 300,
      maxHeight: 520,
      align: 'end',
      gap: 8,
    });
  }

  private reparentPanelToHost(): void {
    const panel = this.panelEl()?.nativeElement ?? this.activePanel;
    if (!panel || panel.parentElement?.id !== 'hq-overlay-root') return;
    const wrap = this.el.nativeElement.querySelector('.hq-date-range-wrap');
    if (!wrap) {
      removeFromOverlay(panel);
      return;
    }
    wrap.appendChild(panel);
    resetAnchoredPopover(panel);
  }

  private purgeOwnedPanels(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document
      .querySelectorAll(`[data-hq-date-range-id="${this.pickerId}"]`)
      .forEach((node) => node.remove());
  }

  private teardownPanel(): void {
    this.reparentPanelToHost();
    this.purgeOwnedPanels();
    if (this.open()) {
      this.open.set(false);
    }
    this.activePanel = null;
    this.coordinator.notifyPanelClosed(this.boundClose);
  }
}
