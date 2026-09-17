import { DatePipe } from '@angular/common';
import { HqCurrencyPipe } from '../../shared/hq-currency.pipe';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { formatHqCurrency } from '../../core/constants/currency.constants';
import { HqDataService } from '../../core/services/hq-data.service';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';
import { HqRequirePermissionDirective } from '../../shared/hq-require-permission.directive';

@Component({
  selector: 'app-subscription-detail-page',
  imports: [RouterLink, HqCurrencyPipe, DatePipe, HqSelect, HqBreadcrumbs, HqRequirePermissionDirective],
  templateUrl: './subscription-detail-page.html',
  styleUrl: './subscription-detail-page.scss',
})
export class SubscriptionDetailPage {
  readonly data = inject(HqDataService);
  private readonly route = inject(ActivatedRoute);

  readonly showPlanChange = signal(false);
  readonly showCancel = signal(false);
  readonly selectedPlanId = signal('');
  readonly changeNote = signal('');
  readonly scheduleAtPeriodEnd = signal(false);

  private readonly subId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );

  readonly subscription = computed(() => this.data.getSubscription(this.subId()));
  readonly org = computed(() => {
    const sub = this.subscription();
    return sub ? this.data.getOrganization(sub.organizationId) : undefined;
  });

  readonly orgInitials = computed(() => {
    const name = this.org()?.name?.trim();
    if (!name) return '—';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  });
  readonly plan = computed(() => {
    const sub = this.subscription();
    return sub ? this.data.getPlan(sub.planId) : undefined;
  });
  readonly features = computed(() => {
    const plan = this.plan();
    if (!plan) return [];
    return this.data.features.filter((f) => plan.featureIds.includes(f.id));
  });
  readonly history = computed(() => this.data.getPlanChangesForSubscription(this.subId()));
  readonly invoices = computed(() => this.data.getInvoicesForSubscription(this.subId()));
  readonly breadcrumb = computed(() => [
    { label: 'Subscriptions', link: '/subscriptions' },
    { label: this.org()?.name ?? 'Subscription detail' },
  ]);
  readonly otherPlans = computed(() => {
    const current = this.plan();
    return this.data.plans().filter((p) => p.id !== current?.id && p.status === 'active');
  });

  readonly planChangeOptions = computed<HqSelectOption[]>(() =>
    this.otherPlans().map((plan) => ({
      value: plan.id,
      label: `${plan.name} · ${formatHqCurrency(plan.priceMonthly)}/mo`,
    })),
  );

  readonly pendingPlan = computed(() => {
    const sub = this.subscription();
    const pending = sub?.pendingPlanChange;
    return pending ? this.data.getPlan(pending.toPlanId) : undefined;
  });

  readonly isDowngrade = computed(() => {
    const current = this.plan();
    const next = this.data.getPlan(this.selectedPlanId());
    if (!current || !next) return false;
    return next.priceMonthly < current.priceMonthly;
  });

  openPlanChange(): void {
    const first = this.otherPlans()[0];
    this.selectedPlanId.set(first?.id ?? '');
    this.changeNote.set('');
    this.scheduleAtPeriodEnd.set(false);
    this.showPlanChange.set(true);
  }

  cancelPlanChange(): void {
    this.showPlanChange.set(false);
  }

  confirmPlanChange(): void {
    const sub = this.subscription();
    if (!sub || !this.selectedPlanId()) return;
    this.data.changeSubscriptionPlan(
      sub.id,
      this.selectedPlanId(),
      this.changeNote().trim() || 'Plan change confirmed from HQ.',
      { scheduleAtPeriodEnd: this.scheduleAtPeriodEnd() || this.isDowngrade() },
    );
    this.showPlanChange.set(false);
  }

  cancelPendingChange(): void {
    const sub = this.subscription();
    if (!sub) return;
    this.data.cancelPendingPlanChange(sub.id);
  }

  retryPayment(): void {
    const sub = this.subscription();
    if (!sub) return;
    this.data.retrySubscriptionPayment(sub.id);
  }

  openCancel(): void {
    this.showCancel.set(true);
  }

  cancelCancel(): void {
    this.showCancel.set(false);
  }

  confirmCancel(): void {
    const sub = this.subscription();
    if (!sub) return;
    this.data.cancelSubscription(sub.id);
    this.showCancel.set(false);
  }

  impact(): { lost: string[]; gained: string[]; seats: string; locations: string } | null {
    const current = this.plan();
    const next = this.data.getPlan(this.selectedPlanId());
    if (!current || !next) return null;
    const lost = current.featureIds
      .filter((id) => !next.featureIds.includes(id))
      .map((id) => this.data.features.find((f) => f.id === id)?.name ?? id);
    const gained = next.featureIds
      .filter((id) => !current.featureIds.includes(id))
      .map((id) => this.data.features.find((f) => f.id === id)?.name ?? id);
    return {
      lost,
      gained,
      seats: `${current.seatsIncluded} → ${next.seatsIncluded}`,
      locations: `${current.locationsIncluded} → ${next.locationsIncluded}`,
    };
  }

  label(value: string): string {
    return value.replace(/_/g, ' ');
  }

  paymentBadgeClass(status: string): string {
    if (status === 'paid') return 'hq-badge-active';
    if (status === 'failed') return 'hq-badge-cancelled';
    if (status === 'pending') return 'hq-badge-past_due';
    return 'hq-badge-archived';
  }

  invoiceBadgeClass(status: string): string {
    if (status === 'paid') return 'hq-badge-active';
    if (status === 'past_due') return 'hq-badge-cancelled';
    if (status === 'open') return 'hq-badge-past_due';
    return 'hq-badge-archived';
  }
}
