import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { clearHqOverlay, purgeOrphanedOverlayPopovers } from './hq-overlay';

/**
 * Ensures only one HQ overlay is active at a time.
 * Select menus and panel popovers (filters, profile) are tracked separately so
 * opening a select inside a filter panel does not collapse the panel.
 */
@Injectable({ providedIn: 'root' })
export class HqPopoverCoordinator {
  private selectClose: (() => void) | null = null;
  private panelClose: (() => void) | null = null;

  constructor() {
    const router = inject(Router);
    const platformId = inject(PLATFORM_ID);
    if (!isPlatformBrowser(platformId)) return;

    router.events
      .pipe(filter((event): event is NavigationStart => event instanceof NavigationStart))
      .subscribe(() => {
        this.closeAll();
        clearHqOverlay();
      });
  }

  requestSelectOpen(close: () => void): void {
    if (this.selectClose && this.selectClose !== close) {
      this.selectClose();
    }
    this.selectClose = close;
  }

  /** Open a select after closing any panel popover (e.g. date calendar). */
  requestSelectOpenExclusive(close: () => void): void {
    this.closePanel();
    purgeOrphanedOverlayPopovers('.hq-date-range-popover');
    this.requestSelectOpen(close);
  }

  notifySelectClosed(close: () => void): void {
    if (this.selectClose === close) {
      this.selectClose = null;
    }
  }

  requestPanelOpen(close: () => void): void {
    this.closeSelect();
    purgeOrphanedOverlayPopovers('.hq-select-menu');
    if (this.panelClose && this.panelClose !== close) {
      this.panelClose();
    }
    this.panelClose = close;
  }

  /** Open a panel after fully closing any open select menu. */
  requestPanelOpenExclusive(close: () => void): void {
    this.requestPanelOpen(close);
  }

  notifyPanelClosed(close: () => void): void {
    if (this.panelClose === close) {
      this.panelClose = null;
    }
  }

  closeSelect(): void {
    if (this.selectClose) {
      const fn = this.selectClose;
      this.selectClose = null;
      fn();
    }
    purgeOrphanedOverlayPopovers('.hq-select-menu');
  }

  closePanel(): void {
    if (this.panelClose) {
      const fn = this.panelClose;
      this.panelClose = null;
      fn();
    }
    purgeOrphanedOverlayPopovers('.hq-date-range-popover');
  }

  closeAll(): void {
    this.closeSelect();
    this.closePanel();
    purgeOrphanedOverlayPopovers();
  }
}
