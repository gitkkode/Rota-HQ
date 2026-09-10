import { DatePipe } from '@angular/common';
import { HqCurrencyPipe } from '../../shared/hq-currency.pipe';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HqDataService } from '../../core/services/hq-data.service';
import { OrgStatus, SubscriptionStatus } from '../../core/models/hq.models';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';
import { HqEmptyState } from '../../shared/hq-empty-state';
import { HqIcon } from '../../shared/hq-icon';
import { HqPagination } from '../../shared/hq-pagination';
import { HqPopoverCoordinator } from '../../shared/hq-popover-coordinator.service';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';
import { HqToastService } from '../../shared/hq-toast.service';
import { HqRequirePermissionDirective } from '../../shared/hq-require-permission.directive';

type SortField = 'name' | 'lastActivity' | 'users' | 'mrr' | 'createdAt';

@Component({
  selector: 'app-organizations-page',
  imports: [
    RouterLink,
    HqCurrencyPipe,
    DatePipe,
    HqSelect,
    HqBreadcrumbs,
    HqPagination,
    HqEmptyState,
    HqIcon,
    HqRequirePermissionDirective,
  ],
  templateUrl: './organizations-page.html',
  styleUrl: './organizations-page.scss',
})
export class OrganizationsPage {
  readonly data = inject(HqDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(HqToastService);
  private readonly popoverCoordinator = inject(HqPopoverCoordinator);
  private readonly boundCloseFilters = (): void => this.closeFilters();

  readonly search = signal('');
  readonly statusFilter = signal<OrgStatus | 'all'>('all');
  readonly subscriptionFilter = signal<SubscriptionStatus | 'all'>('all');
  readonly planFilter = signal<string>('all');
  readonly adminFilter = signal<string>('all');
  readonly sortField = signal<SortField>('lastActivity');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly selected = signal<Set<string>>(new Set());
  readonly filtersOpen = signal(false);

  readonly breadcrumb = [{ label: 'Organizations' }];

  private readonly queryStatus = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('status') as OrgStatus | null)),
    { initialValue: null },
  );

  private readonly queryPlan = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('plan'))),
    { initialValue: null },
  );

  private readonly querySearch = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('q') ?? '')),
    { initialValue: '' },
  );

  readonly statuses: Array<OrgStatus | 'all'> = [
    'all', 'trial', 'active', 'past_due', 'suspended', 'cancelled', 'archived',
  ];

  readonly subscriptionStatuses: Array<SubscriptionStatus | 'all'> = [
    'all', 'trial', 'active', 'past_due', 'suspended', 'cancelled',
  ];

  readonly filtered = computed(() => {
    const q = this.effectiveSearch().trim().toLowerCase();
    const status = this.effectiveStatus();
    const subStatus = this.subscriptionFilter();
    const plan = this.effectivePlan();
    const admin = this.adminFilter();
    const field = this.sortField();
    const dir = this.sortDir();

    const rows = this.data.organizations().filter((org) => {
      const matchesSearch =
        !q ||
        org.name.toLowerCase().includes(q) ||
        org.industry.toLowerCase().includes(q) ||
        org.country.toLowerCase().includes(q);
      const matchesStatus = status === 'all' || org.status === status;
      const matchesSub = subStatus === 'all' || org.subscriptionStatus === subStatus;
      const matchesPlan = plan === 'all' || org.planId === plan;
      const matchesAdmin = admin === 'all' || org.primaryAdminId === admin;
      return matchesSearch && matchesStatus && matchesSub && matchesPlan && matchesAdmin;
    });

    rows.sort((a, b) => {
      let cmp = 0;
      if (field === 'name') cmp = a.name.localeCompare(b.name);
      else if (field === 'users') cmp = a.userCount - b.userCount;
      else if (field === 'mrr') cmp = a.mrr - b.mrr;
      else if (field === 'createdAt') cmp = +new Date(a.createdAt) - +new Date(b.createdAt);
      else cmp = +new Date(a.lastActivityAt) - +new Date(b.lastActivityAt);
      return dir === 'asc' ? cmp : -cmp;
    });

    return rows;
  });

  readonly paged = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  readonly allSelected = computed(
    () =>
      this.paged().length > 0 && this.paged().every((org) => this.selected().has(org.id)),
  );

  readonly effectiveStatus = computed(() => this.queryStatus() ?? this.statusFilter());
  readonly effectivePlan = computed(() => this.queryPlan() ?? this.planFilter());
  readonly effectiveSearch = computed(() => this.querySearch() || this.search());

  readonly hasActiveFilters = computed(
    () =>
      this.effectiveStatus() !== 'all' ||
      this.subscriptionFilter() !== 'all' ||
      this.effectivePlan() !== 'all' ||
      this.adminFilter() !== 'all',
  );

  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.effectiveStatus() !== 'all') count++;
    if (this.subscriptionFilter() !== 'all') count++;
    if (this.effectivePlan() !== 'all') count++;
    if (this.adminFilter() !== 'all') count++;
    return count;
  });

  readonly statusOptions = computed<HqSelectOption[]>(() =>
    this.statuses.map((status) => ({
      value: status,
      label: status === 'all' ? 'All statuses' : this.label(status),
    })),
  );

  readonly subscriptionOptions = computed<HqSelectOption[]>(() =>
    this.subscriptionStatuses.map((status) => ({
      value: status,
      label: status === 'all' ? 'All subscriptions' : this.label(status),
    })),
  );

  readonly planOptions = computed<HqSelectOption[]>(() => [
    { value: 'all', label: 'All plans' },
    ...this.data.plans().map((plan) => ({ value: plan.id, label: plan.name })),
  ]);

  readonly adminOptions = computed<HqSelectOption[]>(() => [
    { value: 'all', label: 'All admins' },
    ...this.data.admins().map((admin) => ({
      value: admin.id,
      label: `${admin.name} (${this.data.getOrganization(admin.organizationId)?.name ?? '—'})`,
    })),
  ]);

  readonly sortOptions: HqSelectOption[] = [
    { value: 'lastActivity:desc', label: 'Last activity ↓' },
    { value: 'lastActivity:asc', label: 'Last activity ↑' },
    { value: 'name:asc', label: 'Name A–Z' },
    { value: 'name:desc', label: 'Name Z–A' },
    { value: 'users:desc', label: 'Users ↓' },
    { value: 'mrr:desc', label: 'MRR ↓' },
    { value: 'createdAt:desc', label: 'Newest first' },
  ];

  setStatus(status: string): void {
    const value = status as OrgStatus | 'all';
    this.statusFilter.set(value);
    this.page.set(1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: value === 'all' ? null : value },
      queryParamsHandling: 'merge',
    });
  }

  setSubscriptionFilter(status: string): void {
    this.subscriptionFilter.set(status as SubscriptionStatus | 'all');
    this.page.set(1);
  }

  setPlan(planId: string): void {
    this.planFilter.set(planId);
    this.page.set(1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { plan: planId === 'all' ? null : planId },
      queryParamsHandling: 'merge',
    });
  }

  setAdminFilter(adminId: string): void {
    this.adminFilter.set(adminId);
    this.page.set(1);
  }

  onSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: value.trim() || null },
      queryParamsHandling: 'merge',
    });
  }

  setSort(value: string): void {
    const [field, dir] = value.split(':') as [SortField, 'asc' | 'desc'];
    this.sortField.set(field);
    this.sortDir.set(dir);
    this.page.set(1);
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
    this.statusFilter.set('all');
    this.subscriptionFilter.set('all');
    this.planFilter.set('all');
    this.adminFilter.set('all');
    this.page.set(1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: null, plan: null },
      queryParamsHandling: 'merge',
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.filters-wrap')) return;
    if (target.closest('.hq-select-menu')) return;
    this.closeFilters();
  }

  toggleSelect(id: string, event: Event): void {
    event.stopPropagation();
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selected.set(new Set());
      return;
    }
    this.selected.set(new Set(this.paged().map((org) => org.id)));
  }

  exportSelected(): void {
    const count = this.selected().size;
    if (!count) {
      this.toast.error('Select at least one organization.', 'Export failed');
      return;
    }
    this.toast.success(`${count} organization(s) exported (mock).`, 'Export complete');
  }

  label(status: string): string {
    return status.replace('_', ' ');
  }

  openCreate(): void {
    void this.router.navigate(['/organizations/new']);
  }

  currentSortValue(): string {
    return `${this.sortField()}:${this.sortDir()}`;
  }
}
