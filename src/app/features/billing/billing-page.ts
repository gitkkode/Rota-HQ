import { DatePipe } from '@angular/common';
import { HqCurrencyPipe } from '../../shared/hq-currency.pipe';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HqDataService } from '../../core/services/hq-data.service';
import { AuditEvent, Invoice, Payment, PaymentGatewayConfig } from '../../core/models/hq.models';
import { InvoiceDetailView, PaymentDetailView } from '../../core/utils/billing-detail.util';
import { activityDetailParagraphs } from '../../core/utils/billing-audit-detail.util';
import { HqIcon } from '../../shared/hq-icon';
import { HqPagination } from '../../shared/hq-pagination';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';
import { HqPageTabs } from '../../shared/hq-page-tabs';
import { HqRequirePermissionDirective } from '../../shared/hq-require-permission.directive';

type BillingTab = 'overview' | 'invoices' | 'payments' | 'activity' | 'gateway';

@Component({
  selector: 'app-billing-page',
  imports: [RouterLink, HqCurrencyPipe, DatePipe, HqSelect, HqPagination, HqIcon, HqRequirePermissionDirective, HqPageTabs],
  templateUrl: './billing-page.html',
  styleUrl: './billing-page.scss',
})
export class BillingPage {
  readonly data = inject(HqDataService);
  readonly tab = signal<BillingTab>('overview');
  readonly invoiceStatus = signal<string>('all');
  readonly paymentStatus = signal<string>('all');
  readonly search = signal('');
  readonly invoicePage = signal(1);
  readonly paymentPage = signal(1);
  readonly pageSize = 10;
  readonly selectedInvoiceId = signal<string | null>(null);
  readonly selectedPaymentId = signal<string | null>(null);
  readonly selectedInvoiceIds = signal<Set<string>>(new Set());
  readonly gatewayDraft = signal<PaymentGatewayConfig>({ ...this.data.paymentGateway() });
  readonly activitySearch = signal('');
  readonly activityCategory = signal<'all' | 'Billing' | 'Subscriptions'>('all');
  readonly activityResult = signal<'all' | AuditEvent['result']>('all');
  readonly activityPage = signal(1);
  readonly selectedActivity = signal<AuditEvent | null>(null);

  readonly summary = this.data.billingSummary;
  readonly billingActivity = this.data.billingActivity;

  readonly failedPayments = computed(() =>
    this.data.payments().filter((p) => p.status === 'failed').slice(0, 5),
  );

  readonly pastDueInvoices = computed(() =>
    this.data.invoices().filter((i) => i.status === 'past_due').slice(0, 5),
  );

  readonly refundedPayments = computed(() =>
    this.data.payments().filter((p) => p.status === 'refunded').slice(0, 5),
  );

  readonly recentActivity = computed(() => this.billingActivity().slice(0, 5));

  readonly activitySummary = computed(() => {
    const events = this.billingActivity();
    return {
      total: events.length,
      success: events.filter((e) => e.result === 'success').length,
      warning: events.filter((e) => e.result === 'warning').length,
      failed: events.filter((e) => e.result === 'failed').length,
    };
  });

  readonly activityCategoryOptions: HqSelectOption[] = [
    { value: 'all', label: 'All categories' },
    { value: 'Billing', label: 'Billing' },
    { value: 'Subscriptions', label: 'Subscriptions' },
  ];

  readonly activityResultOptions: HqSelectOption[] = [
    { value: 'all', label: 'All results' },
    { value: 'success', label: 'Success' },
    { value: 'warning', label: 'Warning' },
    { value: 'failed', label: 'Failed' },
  ];

  readonly filteredActivity = computed(() => {
    const q = this.activitySearch().trim().toLowerCase();
    const category = this.activityCategory();
    const result = this.activityResult();

    return this.billingActivity().filter((event) => {
      const matchesSearch =
        !q ||
        event.actor.toLowerCase().includes(q) ||
        event.action.toLowerCase().includes(q) ||
        event.target.toLowerCase().includes(q) ||
        event.description.toLowerCase().includes(q);
      const matchesCategory = category === 'all' || event.category === category;
      const matchesResult = result === 'all' || event.result === result;
      return matchesSearch && matchesCategory && matchesResult;
    });
  });

  readonly pagedActivity = computed(() => {
    const start = (this.activityPage() - 1) * this.pageSize;
    return this.filteredActivity().slice(start, start + this.pageSize);
  });

  readonly selectedInvoice = computed(() => {
    const id = this.selectedInvoiceId();
    return this.data.invoices().find((i) => i.id === id) ?? null;
  });

  readonly selectedInvoiceDetail = computed((): InvoiceDetailView | null => {
    const id = this.selectedInvoiceId();
    return id ? this.data.getInvoiceDetail(id) : null;
  });

  readonly selectedPaymentDetail = computed((): PaymentDetailView | null => {
    const id = this.selectedPaymentId();
    return id ? this.data.getPaymentDetail(id) : null;
  });

  readonly invoiceStatusOptions: HqSelectOption[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'paid', label: 'Paid' },
    { value: 'open', label: 'Open' },
    { value: 'past_due', label: 'Past due' },
    { value: 'draft', label: 'Draft' },
    { value: 'void', label: 'Void' },
  ];

  readonly paymentStatusOptions: HqSelectOption[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'succeeded', label: 'Succeeded' },
    { value: 'failed', label: 'Failed' },
    { value: 'pending', label: 'Pending' },
    { value: 'refunded', label: 'Refunded' },
  ];

  readonly gatewayModeOptions: HqSelectOption[] = [
    { value: 'test', label: 'Test mode' },
    { value: 'live', label: 'Live mode' },
  ];

  readonly filteredInvoices = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.invoiceStatus();
    return this.data
      .invoices()
      .filter((inv) => {
        const org = this.data.getOrganization(inv.organizationId);
        const matchesSearch =
          !q ||
          inv.number.toLowerCase().includes(q) ||
          org?.name.toLowerCase().includes(q);
        const matchesStatus = status === 'all' || inv.status === status;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt));
  });

  readonly filteredPayments = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.paymentStatus();
    return this.data
      .payments()
      .filter((pay) => {
        const org = this.data.getOrganization(pay.organizationId);
        const invoice = this.data.invoices().find((i) => i.id === pay.invoiceId);
        const matchesSearch =
          !q ||
          pay.id.toLowerCase().includes(q) ||
          pay.transactionId.toLowerCase().includes(q) ||
          pay.receiptNumber.toLowerCase().includes(q) ||
          pay.gatewayReference.toLowerCase().includes(q) ||
          invoice?.number.toLowerCase().includes(q) ||
          org?.name.toLowerCase().includes(q);
        const matchesStatus = status === 'all' || pay.status === status;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => +new Date(b.processedAt) - +new Date(a.processedAt));
  });

  readonly pagedInvoices = computed(() => {
    const start = (this.invoicePage() - 1) * this.pageSize;
    return this.filteredInvoices().slice(start, start + this.pageSize);
  });

  readonly pagedPayments = computed(() => {
    const start = (this.paymentPage() - 1) * this.pageSize;
    return this.filteredPayments().slice(start, start + this.pageSize);
  });

  readonly allInvoicesSelected = computed(() => {
    const page = this.pagedInvoices();
    return page.length > 0 && page.every((inv) => this.selectedInvoiceIds().has(inv.id));
  });

  setTab(tab: BillingTab): void {
    this.tab.set(tab);
    if (tab === 'gateway') {
      this.gatewayDraft.set({ ...this.data.paymentGateway() });
    }
    if (tab === 'activity') {
      this.activityPage.set(1);
    }
  }

  setActivityResultFilter(value: string): void {
    this.activityResult.set(value as 'all' | AuditEvent['result']);
    this.activityPage.set(1);
  }

  setActivityCategory(value: string): void {
    this.activityCategory.set(value as 'all' | 'Billing' | 'Subscriptions');
    this.activityPage.set(1);
  }

  openActivity(auditEvent: AuditEvent, domEvent?: Event): void {
    domEvent?.stopPropagation();
    this.selectedActivity.set(auditEvent);
  }

  closeActivityDrawer(): void {
    this.selectedActivity.set(null);
  }

  activityDetailParagraphs(event: AuditEvent): string[] {
    return activityDetailParagraphs(event);
  }

  openInvoice(inv: Invoice): void {
    this.selectedPaymentId.set(null);
    this.selectedInvoiceId.set(inv.id);
  }

  closeInvoiceDrawer(): void {
    this.selectedInvoiceId.set(null);
  }

  openPayment(pay: Payment): void {
    this.selectedInvoiceId.set(null);
    this.selectedPaymentId.set(pay.id);
  }

  closePaymentDrawer(): void {
    this.selectedPaymentId.set(null);
  }

  openInvoiceFromPayment(invoiceId: string): void {
    this.selectedPaymentId.set(null);
    this.selectedInvoiceId.set(invoiceId);
  }

  downloadInvoice(id: string, event?: Event): void {
    event?.stopPropagation();
    this.data.downloadInvoice(id);
  }

  toggleInvoiceSelect(id: string, event: Event): void {
    event.stopPropagation();
    this.selectedInvoiceIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleSelectAllInvoices(): void {
    const page = this.pagedInvoices();
    if (this.allInvoicesSelected()) {
      this.selectedInvoiceIds.update((set) => {
        const next = new Set(set);
        page.forEach((inv) => next.delete(inv.id));
        return next;
      });
    } else {
      this.selectedInvoiceIds.update((set) => {
        const next = new Set(set);
        page.forEach((inv) => next.add(inv.id));
        return next;
      });
    }
  }

  downloadSelectedInvoices(): void {
    this.data.downloadInvoicesBulk([...this.selectedInvoiceIds()]);
  }

  saveGateway(): void {
    this.data.updatePaymentGateway(this.gatewayDraft());
  }

  connectGateway(): void {
    this.data.connectPaymentGateway();
    this.gatewayDraft.set({ ...this.data.paymentGateway() });
  }

  disconnectGateway(): void {
    this.data.disconnectPaymentGateway();
    this.gatewayDraft.set({ ...this.data.paymentGateway() });
  }

  testGateway(): void {
    this.data.testPaymentGatewayConnection();
    this.gatewayDraft.set({ ...this.data.paymentGateway() });
  }

  updateGatewayField<K extends keyof PaymentGatewayConfig>(key: K, value: PaymentGatewayConfig[K]): void {
    this.gatewayDraft.update((d) => ({ ...d, [key]: value }));
  }

  setGatewayMode(value: string): void {
    this.updateGatewayField('mode', value as 'test' | 'live');
  }

  invoiceBadge(status: string): string {
    if (status === 'paid') return 'hq-badge-active';
    if (status === 'past_due') return 'hq-badge-cancelled';
    if (status === 'open') return 'hq-badge-past_due';
    return 'hq-badge-archived';
  }

  paymentBadge(status: string): string {
    if (status === 'succeeded') return 'hq-badge-active';
    if (status === 'failed') return 'hq-badge-cancelled';
    if (status === 'pending') return 'hq-badge-past_due';
    return 'hq-badge-archived';
  }

  activityResultClass(result: string): string {
    if (result === 'success') return 'hq-badge-active';
    if (result === 'failed') return 'hq-badge-cancelled';
    return 'hq-badge-past_due';
  }

  invoiceNumber(invoiceId: string): string {
    return this.data.invoices().find((i) => i.id === invoiceId)?.number ?? '—';
  }
}
