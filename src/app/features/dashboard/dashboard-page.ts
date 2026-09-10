import { DatePipe, DecimalPipe } from '@angular/common';
import { formatHqCurrencyCompact } from '../../core/constants/currency.constants';
import { HqCurrencyPipe } from '../../shared/hq-currency.pipe';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HqDataService } from '../../core/services/hq-data.service';
import { HqPermissionsService } from '../../core/services/hq-permissions.service';
import { HqIcon } from '../../shared/hq-icon';
import { HqRequirePermissionDirective } from '../../shared/hq-require-permission.directive';
import { HqPopoverCoordinator } from '../../shared/hq-popover-coordinator.service';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';
import { HqDateRange, HqDateRangePicker } from '../../shared/hq-date-range-picker';

import { Organization, PermissionCategoryKey } from '../../core/models/hq.models';

interface DashboardQuickAction {
  label: string;
  link: string;
  queryParams?: Record<string, string>;
  permission: PermissionCategoryKey;
}

interface ChartConfig {
  width: number;
  height: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
}

interface GrowthBarGroup {
  label: string;
  groupX: number;
  signups: number;
  renewals: number;
  signupPath: string;
  renewPath: string;
  hitX: number;
  hitWidth: number;
}

interface RevenuePoint {
  label: string;
  value: number;
  x: number;
  y: number;
  change: number | null;
}

interface DonutSegment {
  planId: string;
  name: string;
  count: number;
  color: string;
  dashArray: string;
  dashOffset: number;
  pct: number;
}

interface GridLabel {
  y: number;
  label: string;
}

type DateRangePreset = '7d' | '30d' | '60d' | '90d' | 'custom';
type RevenuePeriod = '1mo' | '3mo' | '6mo';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, HqCurrencyPipe, DecimalPipe, DatePipe, HqIcon, HqSelect, HqDateRangePicker, HqRequirePermissionDirective],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private static readonly RANGE_END = new Date(2026, 7, 28);

  private readonly router = inject(Router);
  readonly data = inject(HqDataService);
  readonly perms = inject(HqPermissionsService);
  private readonly popoverCoordinator = inject(HqPopoverCoordinator);
  private readonly boundCloseQuickActions = (): void => this.closeQuickActions();

  readonly kpis = this.data.kpis;
  readonly activity = this.data.recentActivity;
  readonly trend = this.data.growthTrend;

  readonly visibleTrend = computed(() => {
    const days = this.effectiveRangeDays();
    const weeks = Math.min(this.trend.length, Math.max(2, Math.ceil(days / 7)));
    return this.trend.slice(-weeks);
  });

  readonly visibleActivity = computed(() => {
    const days = this.effectiveRangeDays();
    const count = Math.min(this.activity.length, Math.max(3, Math.ceil(days / 18)));
    return this.activity.slice(0, count);
  });
  readonly hoverIndex = signal<number | null>(null);
  readonly revenueHoverIndex = signal<number | null>(null);
  readonly donutHoverIndex = signal<number | null>(null);
  readonly quickActionsOpen = signal(false);
  readonly dateRangePreset = signal<DateRangePreset>('60d');
  readonly customDateRange = signal<HqDateRange | null>(null);
  readonly revenuePeriod = signal<RevenuePeriod>('6mo');

  readonly dateRangeLabel = computed(() => {
    const { start, end } = this.effectiveRange();
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  });

  readonly pickerStartDate = computed(() => this.toIsoDate(this.effectiveRange().start));
  readonly pickerEndDate = computed(() => this.toIsoDate(this.effectiveRange().end));
  readonly pickerMaxDate = this.toIsoDate(DashboardPage.RANGE_END);

  readonly revenuePeriodLabel = computed(() => {
    const map: Record<RevenuePeriod, string> = {
      '1mo': 'This Month',
      '3mo': 'Last 3 Months',
      '6mo': 'Last 6 Months',
    };
    return map[this.revenuePeriod()];
  });

  readonly quickActions: DashboardQuickAction[] = [
    { label: 'All organizations', link: '/organizations', permission: 'organizations' },
    { label: 'Active organizations', link: '/organizations', queryParams: { status: 'active' }, permission: 'organizations' },
    { label: 'Trial organizations', link: '/organizations', queryParams: { status: 'trial' }, permission: 'organizations' },
    { label: 'Failed payments', link: '/subscriptions', queryParams: { status: 'past_due' }, permission: 'subscriptions' },
    { label: 'Near usage limits', link: '/usage', permission: 'usage' },
    { label: 'Open support tickets', link: '/support', permission: 'support' },
  ];

  readonly visibleQuickActions = computed(() =>
    this.quickActions.filter((action) => this.perms.canRead(action.permission)),
  );

  readonly dateRangeOptions = computed<HqSelectOption[]>(() => {
    const base: HqSelectOption[] = [
      { value: '7d', label: 'Last 7 days' },
      { value: '30d', label: 'Last 30 days' },
      { value: '60d', label: 'Last 60 days' },
      { value: '90d', label: 'Last 90 days' },
    ];
    if (this.dateRangePreset() === 'custom') {
      return [...base, { value: 'custom', label: 'Custom range' }];
    }
    return base;
  });

  readonly revenuePeriodOptions: HqSelectOption[] = [
    { value: '1mo', label: 'This Month' },
    { value: '3mo', label: 'Last 3 Months' },
    { value: '6mo', label: 'Last 6 Months' },
  ];

  private readonly revenueTrendAll = [
    { label: 'Mar', value: 174_000 },
    { label: 'Apr', value: 189_000 },
    { label: 'May', value: 200_000 },
    { label: 'Jun', value: 209_000 },
    { label: 'Jul', value: 222_000 },
    { label: 'Aug', value: 248_000 },
  ];

  readonly revenueTrend = computed(() => {
    const period = this.revenuePeriod();
    if (period === '1mo') return this.revenueTrendAll.slice(-1);
    if (period === '3mo') return this.revenueTrendAll.slice(-3);
    return this.revenueTrendAll;
  });

  readonly planColors: Record<string, string> = {
    'plan-starter': '#3b82f6',
    'plan-growth': '#22c55e',
    'plan-pro': '#f59e0b',
    'plan-enterprise': '#8b5cf6',
  };

  readonly chart: ChartConfig = {
    width: 600,
    height: 240,
    padLeft: 44,
    padRight: 20,
    padTop: 18,
    padBottom: 32,
  };

  readonly revenueChart: ChartConfig = {
    width: 600,
    height: 240,
    padLeft: 48,
    padRight: 20,
    padTop: 18,
    padBottom: 32,
  };

  readonly topOrganizations = computed(() =>
    [...this.data.organizations()]
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 5),
  );

  readonly planDistribution = computed(() => {
    const orgs = this.data.organizations();
    return this.data.plans().map((plan) => ({
      plan,
      count: orgs.filter((o) => o.planId === plan.id).length,
    }));
  });

  readonly donutSegments = computed<DonutSegment[]>(() => {
    const items = this.planDistribution().filter((i) => i.count > 0);
    const total = items.reduce((sum, i) => sum + i.count, 0) || 1;
    const circumference = 2 * Math.PI * 42;
    let offset = 0;

    return items.map((item) => {
      const fraction = item.count / total;
      const length = fraction * circumference;
      const segment: DonutSegment = {
        planId: item.plan.id,
        name: item.plan.name,
        count: item.count,
        color: this.planColors[item.plan.id] ?? '#94a3b8',
        dashArray: `${length} ${circumference - length}`,
        dashOffset: -offset,
        pct: Math.round(fraction * 100),
      };
      offset += length;
      return segment;
    });
  });

  readonly nearLimitRows = computed(() =>
    this.data
      .usageRows()
      .filter((r) => r.tone === 'near' || r.tone === 'limit')
      .slice(0, 4),
  );

  readonly attentionOrgs = computed(() => this.data.attentionOrganizations().slice(0, 5));
  readonly platformAlerts = computed(() => this.data.platformAlerts);

  readonly recentSignups = this.data.recentSignups;
  readonly recentSubscriptionChanges = this.data.recentSubscriptionChanges;
  readonly platformHealth = this.data.platformHealth;

  readonly openTickets = computed(
    () => this.data.supportSessions().filter((s) => s.status === 'active').length,
  );

  readonly maxTrend = computed(() =>
    Math.max(...this.visibleTrend().map((p) => Math.max(p.signups, p.renewals)), 1),
  );

  readonly maxRevenue = computed(() =>
    Math.max(...this.revenueTrend().map((p) => p.value), 1),
  );

  readonly growthBarGroups = computed<GrowthBarGroup[]>(() => {
    const { width, height, padLeft, padRight, padTop, padBottom } = this.chart;
    const max = this.maxTrend();
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const plotBottom = padTop + plotH;
    const n = this.visibleTrend().length;
    const groupSlot = plotW / n;
    const innerGap = 4;
    const barWidth = Math.min(16, Math.max(8, (groupSlot - innerGap * 3) / 2));

    return this.visibleTrend().map((point, i) => {
      const groupCenter = padLeft + groupSlot * i + groupSlot / 2;
      const signupX = groupCenter - barWidth - innerGap / 2;
      const renewX = groupCenter + innerGap / 2;
      const signupHeight = (point.signups / max) * plotH;
      const renewHeight = (point.renewals / max) * plotH;

      return {
        label: point.label,
        groupX: groupCenter,
        signups: point.signups,
        renewals: point.renewals,
        signupPath: this.roundedTopRect(signupX, plotBottom - signupHeight, barWidth, signupHeight, 4),
        renewPath: this.roundedTopRect(renewX, plotBottom - renewHeight, barWidth, renewHeight, 4),
        hitX: padLeft + groupSlot * i,
        hitWidth: groupSlot,
      };
    });
  });

  readonly revenuePoints = computed<RevenuePoint[]>(() => {
    const { width, height, padLeft, padRight, padTop, padBottom } = this.revenueChart;
    const max = this.maxRevenue();
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const n = this.revenueTrend().length;

    return this.revenueTrend().map((point, i) => {
      const x = padLeft + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
      const y = padTop + plotH - (point.value / max) * plotH;
      const prev = i > 0 ? this.revenueTrend()[i - 1].value : null;
      const change = prev ? Math.round(((point.value - prev) / prev) * 100) : null;
      return { ...point, x, y, change };
    });
  });

  readonly revenuePath = computed(() =>
    this.smoothPath(this.revenuePoints().map((p) => ({ x: p.x, y: p.y }))),
  );

  readonly revenueArea = computed(() =>
    this.areaPath(this.revenuePoints().map((p) => ({ x: p.x, y: p.y })), this.revenueChart),
  );

  readonly growthYLabels = computed<GridLabel[]>(() =>
    this.yLabels(this.maxTrend(), this.chart, (v) => String(Math.round(v))),
  );

  readonly revenueYLabels = computed<GridLabel[]>(() =>
    this.yLabels(this.maxRevenue(), this.revenueChart, (v) => this.formatCurrency(v)),
  );

  readonly gridLines = computed(() => this.gridLineYs(this.chart));

  readonly revenueGridLines = computed(() => this.gridLineYs(this.revenueChart));

  readonly hovered = computed(() => {
    const idx = this.hoverIndex();
    if (idx === null) return null;
    const group = this.growthBarGroups()[idx];
    if (!group) return null;
    return {
      label: group.label,
      signups: group.signups,
      renewals: group.renewals,
      x: group.groupX,
    };
  });

  readonly revenueHovered = computed(() => {
    const idx = this.revenueHoverIndex();
    if (idx === null) return null;
    return this.revenuePoints()[idx] ?? null;
  });

  readonly tooltipLeft = computed(() => {
    const tip = this.hovered();
    if (!tip) return 50;
    return (tip.x / this.chart.width) * 100;
  });

  readonly revenueTooltipLeft = computed(() => {
    const tip = this.revenueHovered();
    if (!tip) return 50;
    return (tip.x / this.revenueChart.width) * 100;
  });

  readonly plotBottom = computed(() => this.chart.height - this.chart.padBottom);
  readonly revenuePlotBottom = computed(() => this.revenueChart.height - this.revenueChart.padBottom);
  readonly plotTop = computed(() => this.chart.padTop);
  readonly revenuePlotTop = computed(() => this.revenueChart.padTop);

  setHover(index: number | null): void {
    this.hoverIndex.set(index);
  }

  setRevenueHover(index: number | null): void {
    this.revenueHoverIndex.set(index);
  }

  setDonutHover(index: number | null): void {
    this.donutHoverIndex.set(index);
  }

  toggleQuickActions(): void {
    if (this.quickActionsOpen()) {
      this.closeQuickActions();
      return;
    }
    this.popoverCoordinator.requestPanelOpen(this.boundCloseQuickActions);
    this.quickActionsOpen.set(true);
  }

  closeQuickActions(): void {
    if (!this.quickActionsOpen()) return;
    this.quickActionsOpen.set(false);
    this.popoverCoordinator.notifyPanelClosed(this.boundCloseQuickActions);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.quick-actions-wrap')) return;
    if (target.closest('.hq-select-menu')) return;
    if (target.closest('.hq-date-range-popover')) return;
    this.closeQuickActions();
  }

  setDateRange(preset: string): void {
    if (preset !== 'custom') {
      this.customDateRange.set(null);
    }
    this.dateRangePreset.set(preset as DateRangePreset);
    this.hoverIndex.set(null);
    this.closeQuickActions();
  }

  onCustomRange(range: HqDateRange): void {
    this.customDateRange.set(range);
    this.dateRangePreset.set('custom');
    this.hoverIndex.set(null);
    this.closeQuickActions();
  }

  onCustomRangeCleared(): void {
    this.customDateRange.set(null);
    this.dateRangePreset.set('60d');
    this.hoverIndex.set(null);
    this.closeQuickActions();
  }

  setRevenuePeriod(period: string): void {
    this.revenuePeriod.set(period as RevenuePeriod);
    this.revenueHoverIndex.set(null);
  }

  goToPlan(planId: string): void {
    this.router.navigate(['/organizations'], { queryParams: { plan: planId } });
  }

  goToOrganization(orgId: string): void {
    this.router.navigate(['/organizations', orgId]);
  }

  activityIcon(tone: string): string {
    if (tone === 'orange') return 'alert';
    if (tone === 'green') return 'check-circle';
    if (tone === 'blue') return 'users';
    if (tone === 'purple') return 'building';
    return 'spark';
  }

  alertPriorityLabel(severity: string): string {
    if (severity === 'critical') return 'High priority';
    if (severity === 'warning') return 'Medium priority';
    return 'Low priority';
  }

  alertSeverityBadge(severity: string): string {
    if (severity === 'critical') return 'hq-badge-cancelled';
    if (severity === 'warning') return 'hq-badge-past_due';
    return 'hq-badge-trial';
  }

  timeInStage(org: Organization): string {
    const days = Math.max(
      1,
      Math.floor((Date.now() - new Date(org.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    );
    if (org.status === 'trial') return `${days}d in trial`;
    if (org.status === 'past_due') return `${days}d past due`;
    if (org.status === 'suspended') return `${days}d suspended`;
    return `${days}d`;
  }

  limitMetric(orgId: string): { label: string; used: number; limit: number } {
    const org = this.data.getOrganization(orgId);
    if (!org) return { label: 'Users', used: 0, limit: 1 };
    const ratios = [
      { label: 'Users', used: org.usage.users, limit: org.usage.usersLimit },
      { label: 'Storage', used: org.usage.storageGb, limit: org.usage.storageLimitGb },
      { label: 'Locations', used: org.usage.locations, limit: org.usage.locationsLimit },
    ];
    return ratios.sort((a, b) => b.used / b.limit - a.used / a.limit)[0];
  }

  private effectiveRange(): { start: Date; end: Date } {
    const custom = this.customDateRange();
    if (this.dateRangePreset() === 'custom' && custom) {
      return { start: this.parseIsoDate(custom.start), end: this.parseIsoDate(custom.end) };
    }

    const days = this.presetDays(this.resolvePreset());
    const end = new Date(DashboardPage.RANGE_END);
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));
    return { start, end };
  }

  private effectiveRangeDays(): number {
    const { start, end } = this.effectiveRange();
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  }

  private resolvePreset(): Exclude<DateRangePreset, 'custom'> {
    const preset = this.dateRangePreset();
    if (preset === 'custom') return '60d';
    return preset;
  }

  private presetDays(preset: Exclude<DateRangePreset, 'custom'>): number {
    const map: Record<Exclude<DateRangePreset, 'custom'>, number> = {
      '7d': 7,
      '30d': 30,
      '60d': 60,
      '90d': 90,
    };
    return map[preset];
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseIsoDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private yLabels(max: number, cfg: ChartConfig, fmt: (v: number) => string): GridLabel[] {
    const plotH = cfg.height - cfg.padTop - cfg.padBottom;
    return [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      y: cfg.padTop + plotH * (1 - t),
      label: fmt(max * t),
    }));
  }

  private gridLineYs(cfg: ChartConfig): { y: number }[] {
    const plotH = cfg.height - cfg.padTop - cfg.padBottom;
    return [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      y: cfg.padTop + plotH * (1 - t),
    }));
  }

  private formatCurrency(value: number): string {
    return formatHqCurrencyCompact(value);
  }

  private areaPath(points: Array<{ x: number; y: number }>, cfg: ChartConfig): string {
    if (points.length < 2) return '';
    const baseY = cfg.height - cfg.padBottom;
    const line = this.smoothPath(points);
    const last = points[points.length - 1];
    const first = points[0];
    return `${line} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
  }

  private roundedTopRect(x: number, y: number, w: number, h: number, r: number): string {
    if (h <= 0 || w <= 0) return '';
    const radius = Math.min(r, w / 2, h);
    return [
      `M ${x} ${y + radius}`,
      `Q ${x} ${y} ${x + radius} ${y}`,
      `L ${x + w - radius} ${y}`,
      `Q ${x + w} ${y} ${x + w} ${y + radius}`,
      `L ${x + w} ${y + h}`,
      `L ${x} ${y + h}`,
      'Z',
    ].join(' ');
  }

  private smoothPath(points: Array<{ x: number; y: number }>): string {
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] ?? p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }
}
