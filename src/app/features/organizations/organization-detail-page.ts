import { DatePipe } from '@angular/common';
import { HqCurrencyPipe } from '../../shared/hq-currency.pipe';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HqDataService } from '../../core/services/hq-data.service';
import { HqPageTabs } from '../../shared/hq-page-tabs';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';
import { HqToastService } from '../../shared/hq-toast.service';
import { HqRequirePermissionDirective } from '../../shared/hq-require-permission.directive';

type OrgTab = 'overview' | 'admins' | 'subscription' | 'features' | 'activity' | 'support';

@Component({
  selector: 'app-organization-detail-page',
  imports: [RouterLink, HqCurrencyPipe, DatePipe, HqSelect, HqBreadcrumbs, HqRequirePermissionDirective, HqPageTabs],
  templateUrl: './organization-detail-page.html',
  styleUrl: './organization-detail-page.scss',
})
export class OrganizationDetailPage {
  readonly data = inject(HqDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(HqToastService);

  readonly tab = signal<OrgTab>('overview');
  readonly confirmSuspend = signal(false);
  readonly confirmCancel = signal(false);
  readonly confirmArchive = signal(false);
  readonly suspendReason = signal('');
  readonly cancelReason = signal('');
  readonly archiveReason = signal('');
  readonly showInvite = signal(false);
  readonly showFeatureOverride = signal(false);
  readonly showSupportStart = signal(false);
  readonly inviteName = signal('');
  readonly inviteEmail = signal('');
  readonly inviteRole = signal('Customer Admin');
  readonly overrideFeatureId = signal('');
  readonly overrideEnabled = signal(true);
  readonly overrideReason = signal('');
  readonly supportReason = signal('');

  private readonly orgId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );

  readonly org = computed(() => this.data.getOrganization(this.orgId()));
  readonly breadcrumb = computed(() => [
    { label: 'Organizations', link: '/organizations' },
    { label: this.org()?.name ?? 'Organization' },
  ]);
  readonly plan = computed(() => {
    const org = this.org();
    return org ? this.data.getPlan(org.planId) : undefined;
  });
  readonly admin = computed(() => {
    const org = this.org();
    return org ? this.data.getPrimaryAdmin(org.id) : undefined;
  });
  readonly admins = computed(() => {
    const org = this.org();
    return org ? this.data.getAdminsForOrg(org.id) : [];
  });
  readonly subscription = computed(() => {
    const org = this.org();
    return org ? this.data.getSubscriptionForOrg(org.id) : undefined;
  });
  readonly effectiveFeatures = computed(() => {
    const org = this.org();
    return org ? this.data.getEffectiveFeaturesForOrg(org.id) : [];
  });
  readonly enabledFeatures = computed(() =>
    this.effectiveFeatures().filter((row) => row.enabled),
  );
  readonly activity = computed(() => {
    const org = this.org();
    return org ? this.data.getOrgActivity(org.id) : [];
  });
  readonly securitySummary = computed(() => {
    const org = this.org();
    if (!org) return { sessions: 0, supportSessions: 0, auditEvents: 0 };
    const orgName = org.name;
    return {
      sessions: this.data.activeSessions().filter((s) => s.organizationName === orgName).length,
      supportSessions: this.data.supportSessions().filter((s) => s.organizationId === org.id).length,
      auditEvents: this.activity().length,
    };
  });

  readonly featureOverrideOptions = computed<HqSelectOption[]>(() =>
    this.data.features.map((f) => ({ value: f.id, label: f.name })),
  );

  initials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  usagePct(used: number, limit: number): number {
    if (!limit) return 0;
    return Math.min(used / limit, 1.25);
  }

  usageClass(used: number, limit: number): string {
    const pct = used / limit;
    if (pct >= 1) return 'limit';
    if (pct >= 0.85) return 'near';
    return 'healthy';
  }

  openSuspend(): void {
    this.confirmSuspend.set(true);
  }

  openCancel(): void {
    this.confirmCancel.set(true);
  }

  openArchive(): void {
    this.confirmArchive.set(true);
  }

  cancelDialog(): void {
    this.confirmSuspend.set(false);
    this.confirmCancel.set(false);
    this.confirmArchive.set(false);
    this.suspendReason.set('');
    this.cancelReason.set('');
    this.archiveReason.set('');
  }

  confirmSuspendAction(): void {
    const org = this.org();
    if (!org || !this.suspendReason().trim()) return;
    this.data.updateOrganizationStatus(org.id, 'suspended', this.suspendReason().trim());
    this.cancelDialog();
  }

  confirmCancelAction(): void {
    const org = this.org();
    if (!org || !this.cancelReason().trim()) return;
    this.data.cancelOrganization(org.id, this.cancelReason().trim());
    this.cancelDialog();
  }

  confirmArchiveAction(): void {
    const org = this.org();
    if (!org || !this.archiveReason().trim()) return;
    this.data.archiveOrganization(org.id, this.archiveReason().trim());
    this.cancelDialog();
  }

  activate(): void {
    const org = this.org();
    if (!org) return;
    this.data.updateOrganizationStatus(org.id, 'active');
  }

  openInvite(): void {
    this.inviteName.set('');
    this.inviteEmail.set('');
    this.inviteRole.set('Customer Admin');
    this.showInvite.set(true);
  }

  cancelInvite(): void {
    this.showInvite.set(false);
  }

  readonly supportSessionsForOrg = computed(() => {
    const org = this.org();
    if (!org) return [];
    return this.data.supportSessions().filter((s) => s.organizationId === org.id);
  });

  submitInvite(): void {
    const org = this.org();
    if (!org || !this.inviteName().trim() || !this.inviteEmail().trim()) {
      this.toast.error('Name and email are required to send an invite.', 'Invite failed');
      return;
    }
    this.data.inviteAdmin({
      organizationId: org.id,
      name: this.inviteName().trim(),
      email: this.inviteEmail().trim(),
      role: this.inviteRole(),
    });
    this.showInvite.set(false);
  }

  toggleAdmin(adminId: string, status: 'active' | 'deactivated'): void {
    this.data.setAdminStatus(adminId, status);
  }

  resendInvite(adminId: string): void {
    this.data.resendAdminInvitation(adminId);
  }

  openFeatureOverride(featureId?: string): void {
    this.overrideFeatureId.set(featureId ?? this.data.features[0]?.id ?? '');
    this.overrideEnabled.set(true);
    this.overrideReason.set('');
    this.showFeatureOverride.set(true);
  }

  submitFeatureOverride(): void {
    const org = this.org();
    if (!org || !this.overrideFeatureId() || !this.overrideReason().trim()) {
      this.toast.error('Feature and reason are required.', 'Override failed');
      return;
    }
    this.data.setOrgFeatureOverride({
      organizationId: org.id,
      featureId: this.overrideFeatureId(),
      enabled: this.overrideEnabled(),
      reason: this.overrideReason().trim(),
    });
    this.showFeatureOverride.set(false);
  }

  removeOverride(featureId: string): void {
    const org = this.org();
    if (!org) return;
    this.data.removeOrgFeatureOverride(org.id, featureId);
  }

  openSupport(): void {
    const org = this.org();
    const admin = org ? this.data.getPrimaryAdmin(org.id) : undefined;
    this.supportReason.set('');
    this.showSupportStart.set(true);
  }

  startSupport(): void {
    const org = this.org();
    const admin = org ? this.data.getPrimaryAdmin(org.id) : undefined;
    if (!org || !admin || !this.supportReason().trim()) {
      this.toast.error('Reason is required to start support.', 'Support failed');
      return;
    }
    this.data.startSupportSession({
      organizationId: org.id,
      targetUserName: admin.name,
      targetUserEmail: admin.email,
      reason: this.supportReason().trim(),
    });
    this.showSupportStart.set(false);
    this.tab.set('support');
  }

  badgeClass(status: string): string {
    if (status === 'active') return 'hq-badge-active';
    if (status === 'invited') return 'hq-badge-trial';
    return 'hq-badge-archived';
  }

  auditResultClass(result: string): string {
    if (result === 'success') return 'hq-badge-active';
    if (result === 'failed') return 'hq-badge-cancelled';
    return 'hq-badge-past_due';
  }
}
