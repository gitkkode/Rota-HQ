import { DatePipe } from '@angular/common';
import { HqCurrencyPipe } from '../../shared/hq-currency.pipe';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HqDataService } from '../../core/services/hq-data.service';
import { SubscriptionStatus } from '../../core/models/hq.models';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';
import { HqPagination } from '../../shared/hq-pagination';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';

@Component({
  selector: 'app-subscriptions-page',
  imports: [RouterLink, HqCurrencyPipe, DatePipe, HqSelect, HqBreadcrumbs, HqPagination],
  templateUrl: './subscriptions-page.html',
  styleUrl: './subscriptions-page.scss',
})
export class SubscriptionsPage {
  readonly data = inject(HqDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly search = signal('');
  readonly statusFilter = signal<SubscriptionStatus | 'all'>('all');
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly breadcrumb = [{ label: 'Subscriptions' }];

  private readonly queryStatus = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('status') as SubscriptionStatus | null)),
    { initialValue: null },
  );

  readonly statuses: Array<SubscriptionStatus | 'all'> = [
    'all',
    'trial',
    'active',
    'past_due',
    'suspended',
    'cancelled',
  ];

  readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.effectiveStatus();
    return this.data
      .subscriptions()
      .map((sub) => ({
        sub,
        org: this.data.getOrganization(sub.organizationId),
        plan: this.data.getPlan(sub.planId),
      }))
      .filter((row) => {
        if (!row.org) return false;
        const matchesSearch =
          !q ||
          row.org.name.toLowerCase().includes(q) ||
          row.plan?.name.toLowerCase().includes(q);
        const matchesStatus = status === 'all' || row.sub.status === status;
        return matchesSearch && matchesStatus;
      });
  });

  readonly pagedRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.rows().slice(start, start + this.pageSize);
  });

  readonly summary = computed(() => {
    const all = this.data.subscriptions();
    return {
      total: all.length,
      active: all.filter((s) => s.status === 'active').length,
      pastDue: all.filter((s) => s.status === 'past_due').length,
      mrr: all.reduce((sum, s) => sum + s.amount, 0),
    };
  });

  readonly effectiveStatus = computed(() => this.queryStatus() ?? this.statusFilter());

  readonly statusOptions = computed<HqSelectOption[]>(() =>
    this.statuses.map((status) => ({
      value: status,
      label: status === 'all' ? 'All statuses' : this.label(status),
    })),
  );

  label(value: string): string {
    return value.replace('_', ' ');
  }

  setStatusFilter(status: string): void {
    const value = status as SubscriptionStatus | 'all';
    this.statusFilter.set(value);
    this.page.set(1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: value === 'all' ? null : value },
      queryParamsHandling: 'merge',
    });
  }
}
