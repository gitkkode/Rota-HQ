import { DatePipe } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HqDataService } from '../../core/services/hq-data.service';
import { AuditEvent } from '../../core/models/hq.models';
import { HqPageTabs } from '../../shared/hq-page-tabs';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';
import { HqIcon } from '../../shared/hq-icon';
import { HqPagination } from '../../shared/hq-pagination';
import { HqPopoverCoordinator } from '../../shared/hq-popover-coordinator.service';
import { activityDetailParagraphs } from '../../core/utils/billing-audit-detail.util';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';

type SecurityTab = 'audit' | 'sessions' | 'signins' | 'alerts';

@Component({
  selector: 'app-security-page',
  imports: [DatePipe, HqSelect, HqIcon, HqBreadcrumbs, HqPagination, HqPageTabs],
  templateUrl: './security-page.html',
  styleUrl: './security-page.scss',
})
export class SecurityPage {
  readonly data = inject(HqDataService);
  private readonly router = inject(Router);
  private readonly popoverCoordinator = inject(HqPopoverCoordinator);
  private readonly boundCloseFilters = (): void => this.closeFilters();
  readonly tab = signal<SecurityTab>('audit');
  readonly search = signal('');
  readonly categoryFilter = signal('all');
  readonly resultFilter = signal<'all' | 'success' | 'failed' | 'warning'>('all');
  readonly dateFilter = signal<'all' | '7d' | '30d'>('all');
  readonly riskFilter = signal<'all' | 'medium' | 'high'>('all');
  readonly filtersOpen = signal(false);
  readonly auditPage = signal(1);
  readonly pageSize = 10;
  readonly selectedAudit = signal<AuditEvent | null>(null);
  readonly breadcrumb = [{ label: 'Security' }];

  readonly hasActiveFilters = computed(
    () =>
      this.categoryFilter() !== 'all' ||
      this.resultFilter() !== 'all' ||
      this.dateFilter() !== 'all',
  );

  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.categoryFilter() !== 'all') count++;
    if (this.resultFilter() !== 'all') count++;
    if (this.dateFilter() !== 'all') count++;
    return count;
  });

  readonly categories = computed(() => [
    'all',
    ...Array.from(new Set(this.data.auditEvents().map((e) => e.category))),
  ]);

  readonly categoryOptions = computed<HqSelectOption[]>(() =>
    this.categories().map((cat) => ({
      value: cat,
      label: cat === 'all' ? 'All categories' : cat,
    })),
  );

  readonly dateOptions: HqSelectOption[] = [
    { value: 'all', label: 'All time' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
  ];

  readonly resultOptions: HqSelectOption[] = [
    { value: 'all', label: 'All results' },
    { value: 'success', label: 'Success' },
    { value: 'warning', label: 'Warning' },
    { value: 'failed', label: 'Failed' },
  ];

  readonly filteredAudit = computed(() => {
    const q = this.search().trim().toLowerCase();
    const category = this.categoryFilter();
    const result = this.resultFilter();
    const dateFilter = this.dateFilter();
    const cutoff =
      dateFilter === '7d'
        ? Date.now() - 7 * 86_400_000
        : dateFilter === '30d'
          ? Date.now() - 30 * 86_400_000
          : 0;

    return this.data.auditEvents().filter((event) => {
      const matchesSearch =
        !q ||
        event.actor.toLowerCase().includes(q) ||
        event.action.toLowerCase().includes(q) ||
        event.target.toLowerCase().includes(q) ||
        event.description.toLowerCase().includes(q);
      const matchesCategory = category === 'all' || event.category === category;
      const matchesResult = result === 'all' || event.result === result;
      const matchesDate = !cutoff || +new Date(event.timestamp) >= cutoff;
      return matchesSearch && matchesCategory && matchesResult && matchesDate;
    });
  });

  readonly pagedAudit = computed(() => {
    const start = (this.auditPage() - 1) * this.pageSize;
    return this.filteredAudit().slice(start, start + this.pageSize);
  });

  readonly sessionSummary = computed(() => {
    const sessions = this.data.activeSessions();
    return {
      total: sessions.length,
      high: sessions.filter((s) => s.risk === 'high').length,
      medium: sessions.filter((s) => s.risk === 'medium').length,
    };
  });

  readonly filteredSessions = computed(() => {
    const risk = this.riskFilter();
    return this.data.activeSessions().filter((session) => {
      if (risk === 'all') return true;
      return session.risk === risk;
    });
  });

  readonly suspiciousSignIns = computed(() =>
    this.data.signInActivity.filter((s) => s.result === 'failed'),
  );

  revoke(sessionId: string): void {
    this.data.revokeSession(sessionId);
  }

  setResultFilter(value: string): void {
    this.resultFilter.set(value as 'all' | 'success' | 'failed' | 'warning');
  }

  setDateFilter(value: string): void {
    this.dateFilter.set(value as 'all' | '7d' | '30d');
    this.auditPage.set(1);
  }

  openAudit(event: AuditEvent): void {
    this.selectedAudit.set(event);
  }

  closeAuditDrawer(): void {
    this.selectedAudit.set(null);
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
    this.categoryFilter.set('all');
    this.resultFilter.set('all');
    this.dateFilter.set('all');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.filters-wrap')) return;
    if (target.closest('.hq-select-menu')) return;
    this.closeFilters();
  }

  auditDetailParagraphs(event: AuditEvent): string[] {
    return activityDetailParagraphs(event);
  }

  navigateFromAudit(event: AuditEvent): void {
    if (event.organizationId) {
      void this.router.navigate(['/organizations', event.organizationId]);
      this.closeAuditDrawer();
      return;
    }
    const org = this.data.organizations().find((o) => o.name === event.target);
    if (org) {
      void this.router.navigate(['/organizations', org.id]);
      this.closeAuditDrawer();
      return;
    }
    if (event.category === 'Billing') {
      void this.router.navigate(['/billing']);
      this.closeAuditDrawer();
      return;
    }
    if (event.category === 'Security') {
      this.tab.set('sessions');
      this.closeAuditDrawer();
    }
  }

  resultClass(result: string): string {
    if (result === 'success') return 'hq-badge-active';
    if (result === 'failed') return 'hq-badge-cancelled';
    return 'hq-badge-past_due';
  }

  riskClass(risk: string): string {
    if (risk === 'low') return 'hq-badge-active';
    if (risk === 'medium') return 'hq-badge-past_due';
    return 'hq-badge-cancelled';
  }

  alertClass(severity: string): string {
    if (severity === 'critical') return 'hq-badge-cancelled';
    if (severity === 'warning') return 'hq-badge-past_due';
    return 'hq-badge-active';
  }
}
