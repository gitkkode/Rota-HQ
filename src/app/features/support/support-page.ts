import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HqDataService } from '../../core/services/hq-data.service';
import { HqPageTabs } from '../../shared/hq-page-tabs';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';
import { HqToastService } from '../../shared/hq-toast.service';
import { HqRequirePermissionDirective } from '../../shared/hq-require-permission.directive';

@Component({
  selector: 'app-support-page',
  imports: [RouterLink, DatePipe, HqSelect, HqBreadcrumbs, HqRequirePermissionDirective, HqPageTabs],
  templateUrl: './support-page.html',
  styleUrl: './support-page.scss',
})
export class SupportPage {
  readonly data = inject(HqDataService);
  private readonly toast = inject(HqToastService);

  readonly tab = signal<'sessions' | 'activity'>('sessions');
  readonly search = signal('');
  readonly statusFilter = signal<'all' | 'active' | 'ended'>('all');
  readonly showStart = signal(false);
  readonly orgId = signal('');
  readonly targetUserId = signal('');
  readonly targetUser = signal('');
  readonly targetEmail = signal('');
  readonly reason = signal('');
  readonly confirmStep = signal(false);

  readonly breadcrumb = [{ label: 'Support' }];

  readonly statusOptions: HqSelectOption[] = [
    { value: 'all', label: 'All sessions' },
    { value: 'active', label: 'Active' },
    { value: 'ended', label: 'Ended' },
  ];

  readonly orgOptions = computed<HqSelectOption[]>(() =>
    this.data.organizations().map((org) => ({ value: org.id, label: org.name })),
  );

  readonly userOptions = computed<HqSelectOption[]>(() => {
    const orgId = this.orgId();
    if (!orgId) return [];
    return this.data.getUsersForOrg(orgId).map((u) => ({
      value: u.id,
      label: `${u.name} (${u.email})`,
    }));
  });

  readonly sessions = computed(() => {
    const status = this.statusFilter();
    const q = this.search().trim().toLowerCase();
    return this.data
      .supportSessions()
      .filter((s) => {
        if (status !== 'all' && s.status !== status) return false;
        if (!q) return true;
        const orgName = this.data.getOrganization(s.organizationId)?.name ?? '';
        return (
          orgName.toLowerCase().includes(q) ||
          s.targetUserName.toLowerCase().includes(q) ||
          s.targetUserEmail.toLowerCase().includes(q) ||
          s.operatorName.toLowerCase().includes(q) ||
          s.reason.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt));
  });

  readonly supportAudit = computed(() =>
    this.data
      .auditEvents()
      .filter((e) => e.category === 'Support' || e.supportSessionId)
      .slice(0, 20),
  );

  readonly summary = computed(() => {
    const all = this.data.supportSessions();
    return {
      active: all.filter((s) => s.status === 'active').length,
      ended: all.filter((s) => s.status === 'ended').length,
      total: all.length,
    };
  });

  openStart(): void {
    const firstOrg = this.data.organizations()[0];
    this.orgId.set(firstOrg?.id ?? '');
    if (firstOrg) {
      const users = this.data.getUsersForOrg(firstOrg.id);
      const admin = this.data.getPrimaryAdmin(firstOrg.id);
      const pick = users[0] ?? admin;
      this.targetUserId.set(users[0]?.id ?? '');
      this.targetUser.set(pick?.name ?? '');
      this.targetEmail.set(pick?.email ?? '');
    } else {
      this.targetUserId.set('');
      this.targetUser.set('');
      this.targetEmail.set('');
    }
    this.reason.set('');
    this.confirmStep.set(false);
    this.showStart.set(true);
  }

  onOrgChange(id: string): void {
    this.orgId.set(id);
    const users = this.data.getUsersForOrg(id);
    const first = users[0];
    if (first) {
      this.targetUserId.set(first.id);
      this.targetUser.set(first.name);
      this.targetEmail.set(first.email);
    } else {
      const admin = this.data.getPrimaryAdmin(id);
      this.targetUserId.set('');
      this.targetUser.set(admin?.name ?? '');
      this.targetEmail.set(admin?.email ?? '');
    }
  }

  onUserChange(userId: string): void {
    this.targetUserId.set(userId);
    const user = this.data.getUsersForOrg(this.orgId()).find((u) => u.id === userId);
    if (user) {
      this.targetUser.set(user.name);
      this.targetEmail.set(user.email);
    }
  }

  cancelStart(): void {
    this.showStart.set(false);
    this.confirmStep.set(false);
  }

  goConfirm(): void {
    if (!this.orgId() || !this.targetUser().trim() || !this.reason().trim()) {
      this.toast.error('Organization, target user, and reason are required.', 'Session failed');
      return;
    }
    this.confirmStep.set(true);
  }

  startSession(): void {
    this.data.startSupportSession({
      organizationId: this.orgId(),
      targetUserName: this.targetUser().trim(),
      targetUserEmail: this.targetEmail().trim(),
      reason: this.reason().trim(),
    });
    this.showStart.set(false);
    this.confirmStep.set(false);
    this.statusFilter.set('active');
    this.tab.set('sessions');
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value as 'all' | 'active' | 'ended');
  }

  endSession(id: string): void {
    this.data.endSupportSession(id);
  }
}
