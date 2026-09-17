import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';
import { HqAuthService } from '../../core/services/hq-auth.service';
import { HqDataService } from '../../core/services/hq-data.service';
import { HqPermissionsService } from '../../core/services/hq-permissions.service';
import { HqIcon } from '../../shared/hq-icon';
import { HqPopoverCoordinator } from '../../shared/hq-popover-coordinator.service';
import { HqToastContainer } from '../../shared/hq-toast-container';

@Component({
  selector: 'app-hq-shell',
  imports: [RouterOutlet, RouterLink, DatePipe, HqIcon, HqToastContainer],
  templateUrl: './hq-shell.html',
  styleUrl: './hq-shell.scss',
})
export class HqShell implements AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  readonly data = inject(HqDataService);
  readonly auth = inject(HqAuthService);
  readonly perms = inject(HqPermissionsService);
  private readonly popoverCoordinator = inject(HqPopoverCoordinator);
  private readonly boundCloseProfile = (): void => this.closeProfileMenu();

  readonly sidebarOpen = signal(true);
  readonly compactLayout = signal(false);
  readonly searchQuery = signal('');
  readonly profileMenuOpen = signal(false);
  readonly indicatorTop = signal(0);
  readonly indicatorHeight = signal(44);
  readonly indicatorReady = signal(false);

  readonly navEl = viewChild<ElementRef<HTMLElement>>('navEl');
  readonly navLinks = viewChildren<ElementRef<HTMLAnchorElement>>('navLink');

  readonly navItems = this.perms.visibleNavItems;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly pageTitle = computed(() => {
    const current = this.url().split('?')[0];
    if (current === '/organizations/new') {
      return 'Create Organization';
    }
    if (current.startsWith('/organizations/') && current !== '/organizations') {
      return 'Organization Detail';
    }
    if (current.startsWith('/subscriptions/') && current !== '/subscriptions') {
      return 'Subscription Detail';
    }
    if (current === '/plans/new') {
      return 'Create Plan';
    }
    if (current.startsWith('/plans/') && current !== '/plans') {
      return 'Plan Detail';
    }
    if (current.startsWith('/permissions/') && current !== '/permissions') {
      return 'Role Detail';
    }
    const match = this.navItems().find(
      (item) => current === item.path || current.startsWith(`${item.path}/`),
    );
    return match?.label ?? 'Workforce HQ';
  });

  private resizeObserver?: ResizeObserver;
  private rafId = 0;
  private mediaQuery?: MediaQueryList;
  private readonly compactMq = '(max-width: 960px)';
  private readonly onCompactChange = (event: MediaQueryListEvent): void => {
    this.applyCompactLayout(event.matches);
  };

  constructor() {
    effect(() => {
      this.perms.visibleNavItems();
      this.url();
      this.sidebarOpen();
      this.navLinks();
      if (this.isBrowser) this.scheduleIndicatorUpdate();
    });

    effect(() => {
      this.url();
      untracked(() => this.closeMobileNav());
    });
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.initCompactLayout();
    this.updateIndicator(true);
    const nav = this.navEl()?.nativeElement;
    if (nav && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleIndicatorUpdate());
      this.resizeObserver.observe(nav);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mediaQuery?.removeEventListener('change', this.onCompactChange);
    if (this.isBrowser) cancelAnimationFrame(this.rafId);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
    if (!this.isBrowser) return;
    this.indicatorReady.set(false);
    setTimeout(() => this.updateIndicator(true), 220);
  }

  closeMobileNav(): void {
    if (this.compactLayout() && this.sidebarOpen()) {
      this.sidebarOpen.set(false);
    }
  }

  onNavNavigate(): void {
    this.closeMobileNav();
  }

  private initCompactLayout(): void {
    const mq = window.matchMedia(this.compactMq);
    this.mediaQuery = mq;
    this.applyCompactLayout(mq.matches);
    mq.addEventListener('change', this.onCompactChange);
  }

  private applyCompactLayout(compact: boolean): void {
    const wasCompact = this.compactLayout();
    this.compactLayout.set(compact);
    if (compact === wasCompact) return;
    this.sidebarOpen.set(!compact);
    this.indicatorReady.set(false);
    setTimeout(() => this.updateIndicator(true), 220);
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
  }

  submitSearch(event: Event): void {
    event.preventDefault();
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return;

    const org = this.data.organizations().find(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.industry.toLowerCase().includes(q) ||
        o.country.toLowerCase().includes(q),
    );
    if (org) {
      void this.router.navigate(['/organizations', org.id]);
      return;
    }

    const user = this.data.globalUsers().find(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
    if (user) {
      void this.router.navigate(['/organizations', user.organizationId]);
      return;
    }

    const plan = this.data.plans().find((p) => p.name.toLowerCase().includes(q));
    if (plan) {
      void this.router.navigate(['/plans', plan.id]);
      return;
    }

    void this.router.navigate(['/organizations'], { queryParams: { q: this.searchQuery().trim() } });
  }

  toggleProfileMenu(): void {
    if (this.profileMenuOpen()) {
      this.closeProfileMenu();
      return;
    }
    this.popoverCoordinator.requestPanelOpen(this.boundCloseProfile);
    this.profileMenuOpen.set(true);
  }

  closeProfileMenu(): void {
    if (!this.profileMenuOpen()) return;
    this.profileMenuOpen.set(false);
    this.popoverCoordinator.notifyPanelClosed(this.boundCloseProfile);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMobileNav();
    this.closeProfileMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isBrowser) return;
    const target = event.target as HTMLElement;
    if (target.closest('.profile-wrap')) return;
    if (target.closest('.hq-select-menu')) return;
    this.closeProfileMenu();
  }

  navigateFromProfile(path: string): void {
    void this.router.navigate([path]);
    this.closeProfileMenu();
  }

  signOut(): void {
    this.auth.logout();
    this.closeProfileMenu();
    void this.router.navigate(['/auth/login']);
  }

  endSupport(): void {
    const active = this.data.activeSupportSession();
    if (active) this.data.endSupportSession(active.id);
  }

  isActive(path: string): boolean {
    const current = this.url().split('?')[0];
    if (path === '/dashboard') return current === '/dashboard' || current === '/';
    return current === path || current.startsWith(`${path}/`);
  }

  isDashboard(): boolean {
    const current = this.url().split('?')[0];
    return current === '/dashboard' || current === '/';
  }

  private scheduleIndicatorUpdate(): void {
    if (!this.isBrowser) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => {
      this.rafId = requestAnimationFrame(() => this.updateIndicator());
    });
  }

  private updateIndicator(instant = false): void {
    if (!this.isBrowser) return;

    const links = this.navLinks();
    const nav = this.navEl()?.nativeElement;
    if (!nav || !links.length) return;

    const idx = this.navItems().findIndex((item) => this.isActive(item.path));
    const link = links[idx];
    if (!link) return;

    const el = link.nativeElement;
    const navRect = nav.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const top = elRect.top - navRect.top + nav.scrollTop;
    const height = elRect.height;

    if (instant || !this.indicatorReady()) {
      this.indicatorReady.set(false);
      this.indicatorTop.set(top);
      this.indicatorHeight.set(height);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.indicatorReady.set(true));
      });
      return;
    }

    this.indicatorTop.set(top);
    this.indicatorHeight.set(height);
  }
}
