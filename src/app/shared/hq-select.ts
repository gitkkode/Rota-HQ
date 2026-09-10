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

export interface HqSelectOption {
  value: string;
  label: string;
}

let nextSelectId = 0;

@Component({
  selector: 'app-hq-select',
  imports: [HqIcon],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="hq-select-wrap" [class.open]="open()" [style.minWidth]="minWidth()">
      <button
        type="button"
        class="hq-select-trigger"
        (mousedown)="$event.preventDefault()"
        (click)="toggle($event)"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
      >
        @if (leadingIcon()) {
          <app-hq-icon [name]="leadingIcon()!" [size]="14" />
        }
        <span class="hq-select-value">{{ selectedLabel() }}</span>
        <app-hq-icon class="hq-select-chevron" name="chevron-down" [size]="14" />
      </button>
      @if (open()) {
        <ul
          #menuEl
          class="hq-popover hq-select-menu"
          role="listbox"
          [attr.data-hq-select-id]="selectId"
          (click)="$event.stopPropagation()"
        >
          @for (opt of options(); track opt.value) {
            <li>
              <button
                type="button"
                role="option"
                class="hq-popover-item"
                [class.active]="opt.value === value()"
                [attr.aria-selected]="opt.value === value()"
                (click)="pick(opt.value)"
              >
                {{ opt.label }}
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class HqSelect {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly coordinator = inject(HqPopoverCoordinator);
  private readonly boundClose = (): void => this.forceClose();
  readonly selectId = `hq-select-${++nextSelectId}`;
  private activeMenu: HTMLElement | null = null;

  readonly menuEl = viewChild<ElementRef<HTMLElement>>('menuEl');

  readonly options = input.required<HqSelectOption[]>();
  readonly value = input('');
  readonly placeholder = input('Select...');
  readonly minWidth = input('148px');
  readonly leadingIcon = input<string | null>(null);
  readonly closePanelsOnOpen = input(false);
  readonly menuAlign = input<'start' | 'end'>('start');
  readonly valueChange = output<string>();
  readonly opened = output<void>();

  readonly open = signal(false);

  readonly selectedLabel = computed(() => {
    const match = this.options().find((o) => o.value === this.value());
    return match?.label ?? this.placeholder();
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        if (!this.open()) return;
        afterNextRender(() => this.syncMenu(), { injector: this.injector });
      });

      afterEveryRender(() => {
        if (this.open()) this.ensurePortaled();
      }, { injector: this.injector });

      const reposition = (): void => {
        if (this.open()) this.syncMenuPosition();
      };
      window.addEventListener('scroll', reposition, true);
      window.addEventListener('resize', reposition);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', reposition, true);
        window.removeEventListener('resize', reposition);
        this.teardownMenu();
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
    if (this.closePanelsOnOpen()) {
      this.coordinator.requestSelectOpenExclusive(this.boundClose);
    } else {
      this.coordinator.requestSelectOpen(this.boundClose);
    }
    this.open.set(true);
    this.opened.emit();
  }

  pick(value: string): void {
    this.valueChange.emit(value);
    this.close();
  }

  close(): void {
    this.forceClose();
  }

  forceClose(): void {
    const wasOpen = this.open();
    this.reparentMenuToHost();
    this.open.set(false);
    this.activeMenu = null;
    if (wasOpen) {
      this.coordinator.notifySelectClosed(this.boundClose);
    }
    this.purgeOwnedMenus();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!isPlatformBrowser(this.platformId) || !this.open()) return;
    const target = event.target as Node;
    if (this.el.nativeElement.contains(target)) return;
    const menu = this.menuEl()?.nativeElement ?? this.activeMenu;
    if (menu?.contains(target)) return;
    this.close();
  }

  private ensurePortaled(): void {
    const menu = this.menuEl()?.nativeElement;
    if (!menu) return;
    this.activeMenu = menu;
    portalToOverlay(menu);
  }

  private syncMenu(): void {
    this.syncMenuPosition();
  }

  private syncMenuPosition(): void {
    const menu = this.menuEl()?.nativeElement;
    const trigger = this.el.nativeElement.querySelector('.hq-select-trigger') as HTMLElement | null;
    if (!menu || !trigger) return;
    this.activeMenu = menu;
    portalToOverlay(menu);
    syncAnchoredPopover(trigger, menu, {
      minWidth: trigger.getBoundingClientRect().width,
      gap: 10,
      align: this.menuAlign(),
    });
  }

  private reparentMenuToHost(): void {
    const menu = this.menuEl()?.nativeElement ?? this.activeMenu;
    if (!menu || menu.parentElement?.id !== 'hq-overlay-root') return;
    const wrap = this.el.nativeElement.querySelector('.hq-select-wrap');
    if (!wrap) {
      removeFromOverlay(menu);
      return;
    }
    wrap.appendChild(menu);
    resetAnchoredPopover(menu);
  }

  private purgeOwnedMenus(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document
      .querySelectorAll(`[data-hq-select-id="${this.selectId}"]`)
      .forEach((node) => node.remove());
  }

  private teardownMenu(): void {
    this.reparentMenuToHost();
    this.purgeOwnedMenus();
    if (this.open()) {
      this.open.set(false);
    }
    this.activeMenu = null;
    this.coordinator.notifySelectClosed(this.boundClose);
  }
}
