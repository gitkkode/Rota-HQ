import { DatePipe } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HqDataService } from '../../core/services/hq-data.service';
import {
  buildAdminProfileDetail,
  buildGlobalUserProfileDetail,
  UserProfileDetail,
} from '../../core/utils/user-profile-detail.util';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';
import { HqPageTabs } from '../../shared/hq-page-tabs';
import { HqEmptyState } from '../../shared/hq-empty-state';
import { HqIcon } from '../../shared/hq-icon';
import { HqPagination } from '../../shared/hq-pagination';
import { HqPopoverCoordinator } from '../../shared/hq-popover-coordinator.service';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';
import { HqToastService } from '../../shared/hq-toast.service';
import { HqRequirePermissionDirective } from '../../shared/hq-require-permission.directive';

@Component({
  selector: 'app-users-page',
  imports: [RouterLink, DatePipe, HqSelect, HqIcon, HqPagination, HqEmptyState, HqRequirePermissionDirective, HqPageTabs],
  templateUrl: './users-page.html',
  styleUrl: './users-page.scss',
})
export class UsersPage {
  readonly data = inject(HqDataService);
  private readonly router = inject(Router);
  private readonly popoverCoordinator = inject(HqPopoverCoordinator);
  private readonly toast = inject(HqToastService);
  private readonly boundCloseFilters = (): void => this.closeFilters();
  readonly tab = signal<'admins' | 'users'>('admins');
  readonly search = signal('');
  readonly statusFilter = signal<'all' | 'active' | 'invited' | 'deactivated'>('all');
  readonly roleFilter = signal<'all' | 'Admin' | 'Manager' | 'Employee'>('all');
  readonly orgFilter = signal('all');
  readonly filtersOpen = signal(false);
  readonly showInvite = signal(false);
  readonly selectedUserId = signal<string | null>(null);
  readonly selectedAdminId = signal<string | null>(null);
  readonly drawerOpen = signal(false);
  readonly adminDrawerOpen = signal(false);
  readonly page = signal(1);
  readonly pageSize = 10;
  readonly inviteOrgId = signal('');
  readonly inviteName = signal('');
  readonly inviteEmail = signal('');
  readonly inviteRole = signal('Customer Admin');

  readonly statusOptions: HqSelectOption[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'invited', label: 'Invited' },
    { value: 'deactivated', label: 'Deactivated' },
  ];

  readonly roleOptions: HqSelectOption[] = [
    { value: 'all', label: 'All roles' },
    { value: 'Admin', label: 'Admin' },
    { value: 'Manager', label: 'Manager' },
    { value: 'Employee', label: 'Employee' },
  ];

  readonly orgOptions = computed<HqSelectOption[]>(() => [
    { value: 'all', label: 'All organizations' },
    ...this.data.organizations().map((org) => ({ value: org.id, label: org.name })),
  ]);

  readonly inviteOrgOptions = computed<HqSelectOption[]>(() =>
    this.data.organizations().map((org) => ({ value: org.id, label: org.name })),
  );

  readonly hasActiveFilters = computed(
    () => this.statusFilter() !== 'all' || this.orgFilter() !== 'all' || this.roleFilter() !== 'all',
  );

  readonly activeFilterCount = computed(() => {
    let count = 0;
    if (this.statusFilter() !== 'all') count++;
    if (this.orgFilter() !== 'all') count++;
    if (this.roleFilter() !== 'all') count++;
    return count;
  });

  readonly filteredAdmins = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const org = this.orgFilter();
    return this.data.admins().filter((admin) => {
      const orgName = this.data.getOrganization(admin.organizationId)?.name.toLowerCase() ?? '';
      const matchesSearch =
        !q ||
        admin.name.toLowerCase().includes(q) ||
        admin.email.toLowerCase().includes(q) ||
        orgName.includes(q);
      const matchesStatus = status === 'all' || admin.status === status;
      const matchesOrg = org === 'all' || admin.organizationId === org;
      return matchesSearch && matchesStatus && matchesOrg;
    });
  });

  readonly filteredUsers = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const org = this.orgFilter();
    const role = this.roleFilter();
    return this.data.globalUsers().filter((user) => {
      const orgName = this.data.getOrganization(user.organizationId)?.name.toLowerCase() ?? '';
      const matchesSearch =
        !q ||
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        orgName.includes(q);
      const matchesStatus = status === 'all' || user.status === status;
      const matchesOrg = org === 'all' || user.organizationId === org;
      const matchesRole = role === 'all' || user.role === role;
      return matchesSearch && matchesStatus && matchesOrg && matchesRole;
    });
  });

  readonly selectedUser = computed(() => {
    const id = this.selectedUserId();
    return this.data.globalUsers().find((u) => u.id === id) ?? null;
  });

  readonly selectedAdmin = computed(() => {
    const id = this.selectedAdminId();
    return this.data.admins().find((a) => a.id === id) ?? null;
  });

  readonly selectedAdminDetail = computed((): UserProfileDetail | null => {
    const admin = this.selectedAdmin();
    if (!admin) return null;
    const org = this.data.getOrganization(admin.organizationId);
    const plan = org ? this.data.getPlan(org.planId) : undefined;
    const sub = this.data.getSubscriptionForOrg(admin.organizationId);
    return buildAdminProfileDetail(
      admin,
      org,
      plan,
      sub,
      this.data.getSignInForUser(admin.email),
      this.data.getAuditForUser(admin.email),
    );
  });

  readonly selectedUserDetail = computed((): UserProfileDetail | null => {
    const user = this.selectedUser();
    if (!user) return null;
    const org = this.data.getOrganization(user.organizationId);
    const plan = org ? this.data.getPlan(org.planId) : undefined;
    const sub = this.data.getSubscriptionForOrg(user.organizationId);
    return buildGlobalUserProfileDetail(
      user,
      org,
      plan,
      sub,
      this.data.getSignInForUser(user.email),
      this.data.getAuditForUser(user.email),
    );
  });

  signInResultClass(result: string): string {
    if (result === 'success') return 'hq-badge-active';
    if (result === 'failed') return 'hq-badge-archived';
    return 'hq-badge-trial';
  }

  readonly pagedAdmins = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredAdmins().slice(start, start + this.pageSize);
  });

  readonly pagedUsers = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredUsers().slice(start, start + this.pageSize);
  });

  openInvite(): void {
    this.inviteOrgId.set(this.data.organizations()[0]?.id ?? '');
    this.inviteName.set('');
    this.inviteEmail.set('');
    this.inviteRole.set('Customer Admin');
    this.showInvite.set(true);
  }

  cancelInvite(): void {
    this.showInvite.set(false);
  }

  submitInvite(): void {
    if (!this.inviteOrgId() || !this.inviteName().trim() || !this.inviteEmail().trim()) {
      this.toast.error('Organization, name, and email are required.', 'Invite failed');
      return;
    }
    this.data.inviteAdmin({
      organizationId: this.inviteOrgId(),
      name: this.inviteName().trim(),
      email: this.inviteEmail().trim(),
      role: this.inviteRole(),
    });
    this.showInvite.set(false);
    this.tab.set('admins');
  }

  toggleAdmin(adminId: string, status: 'active' | 'deactivated'): void {
    this.data.setAdminStatus(adminId, status);
  }

  initials(name: string): string {
    return name
      .split(' ')
      .map((p) => p[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  badgeClass(status: string): string {
    if (status === 'active') return 'hq-badge-active';
    if (status === 'invited') return 'hq-badge-trial';
    return 'hq-badge-archived';
  }

  goToOrg(orgId: string): void {
    void this.router.navigate(['/organizations', orgId]);
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value as 'all' | 'active' | 'invited' | 'deactivated');
  }

  setRoleFilter(value: string): void {
    this.roleFilter.set(value as 'all' | 'Admin' | 'Manager' | 'Employee');
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

  resendInvite(adminId: string): void {
    this.data.resendAdminInvitation(adminId);
  }

  openUserProfile(userId: string): void {
    this.selectedUserId.set(userId);
    this.drawerOpen.set(true);
  }

  openAdminProfile(adminId: string): void {
    this.selectedAdminId.set(adminId);
    this.adminDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  closeAdminDrawer(): void {
    this.adminDrawerOpen.set(false);
  }

  clearFilters(): void {
    this.statusFilter.set('all');
    this.orgFilter.set('all');
    this.roleFilter.set('all');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('.users-filters-wrap')) return;
    if (target.closest('.hq-select-menu')) return;
    this.closeFilters();
  }
}
