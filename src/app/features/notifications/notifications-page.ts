import { DatePipe } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HqDataService } from '../../core/services/hq-data.service';
import { HqNotification } from '../../core/models/hq.models';
import { HqPageTabs } from '../../shared/hq-page-tabs';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';
import { HqEmptyState } from '../../shared/hq-empty-state';
import { HqIcon } from '../../shared/hq-icon';
import { HqPopoverCoordinator } from '../../shared/hq-popover-coordinator.service';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';

@Component({
  selector: 'app-notifications-page',
  imports: [RouterLink, DatePipe, HqSelect, HqIcon, HqBreadcrumbs, HqEmptyState, HqPageTabs],
  templateUrl: './notifications-page.html',
  styleUrl: './notifications-page.scss',
})
export class NotificationsPage {
  readonly data = inject(HqDataService);
  private readonly popoverCoordinator = inject(HqPopoverCoordinator);
  private readonly boundCloseFilters = (): void => this.closeFilters();

  readonly pageTab = signal<'inbox' | 'templates'>('inbox');

  readonly search = signal('');
  readonly category = signal<'all' | HqNotification['category']>('all');
  readonly unreadOnly = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly listFilter = signal<'all' | 'unread'>('all');
  readonly filtersOpen = signal(false);

  readonly hasActiveFilters = computed(
    () => this.category() !== 'all' || this.unreadOnly(),
  );

  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.category() !== 'all') count++;
    if (this.unreadOnly()) count++;
    return count;
  });

  readonly categories = [
    'all',
    'organization',
    'billing',
    'usage',
    'security',
    'integration',
    'platform',
  ] as const;

  readonly categoryOptions: HqSelectOption[] = [
    { value: 'all', label: 'All categories' },
    { value: 'organization', label: 'Organization' },
    { value: 'billing', label: 'Billing' },
    { value: 'usage', label: 'Usage' },
    { value: 'security', label: 'Security' },
    { value: 'integration', label: 'Integration' },
    { value: 'platform', label: 'Platform' },
  ];

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.data
      .visibleNotifications()
      .filter((n) => {
        const matchesSearch =
          !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q);
        const matchesCategory = this.category() === 'all' || n.category === this.category();
        const matchesUnread = !this.unreadOnly() || !n.read;
        const matchesList = this.listFilter() === 'all' || !n.read;
        return matchesSearch && matchesCategory && matchesUnread && matchesList;
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  });

  readonly selected = computed(() => {
    const id = this.selectedId();
    return this.data.visibleNotifications().find((n) => n.id === id) ?? this.filtered()[0] ?? null;
  });

  open(id: string): void {
    this.selectedId.set(id);
    this.data.markNotificationRead(id);
  }

  markAll(): void {
    this.data.markAllNotificationsRead();
  }

  setListFilter(filter: 'all' | 'unread'): void {
    this.listFilter.set(filter);
    this.unreadOnly.set(filter === 'unread');
  }

  setCategory(value: string): void {
    this.category.set(value as 'all' | HqNotification['category']);
  }

  toggleFilters(): void {
    if (this.filtersOpen()) {
      this.closeFilters();
      return;
    }
    this.popoverCoordinator.requestPanelOpen(this.boundCloseFilters);
    this.filtersOpen.set(true);
  }

  closeFilters(): void {
    if (!this.filtersOpen()) return;
    this.filtersOpen.set(false);
    this.popoverCoordinator.notifyPanelClosed(this.boundCloseFilters);
  }

  clearFilters(): void {
    this.category.set('all');
    this.unreadOnly.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.filters-wrap')) return;
    if (target.closest('.hq-select-menu')) return;
    this.closeFilters();
  }

  categoryLabel(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }

  categoryClass(category: string): string {
    if (category === 'billing') return 'hq-badge-past_due';
    if (category === 'security') return 'hq-badge-cancelled';
    if (category === 'usage') return 'hq-badge-trial';
    return 'hq-badge-active';
  }

  readonly breadcrumb = [{ label: 'Notifications' }];

  toggleTemplate(id: string): void {
    this.data.toggleNotificationTemplate(id);
  }
}
