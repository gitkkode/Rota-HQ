import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HqDataService } from '../../core/services/hq-data.service';
import { HqPermissionsService } from '../../core/services/hq-permissions.service';
import { PermissionCategoryKey, PermissionLevel } from '../../core/models/hq.models';
import { HqPageTabs } from '../../shared/hq-page-tabs';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';
import { HqSelect, HqSelectOption } from '../../shared/hq-select';
import { HqToastService } from '../../shared/hq-toast.service';

@Component({
  selector: 'app-permissions-page',
  imports: [RouterLink, DatePipe, HqSelect, HqBreadcrumbs, HqPageTabs],
  templateUrl: './permissions-page.html',
  styleUrl: './permissions-page.scss',
})
export class PermissionsPage {
  readonly data = inject(HqDataService);
  readonly perms = inject(HqPermissionsService);
  private readonly toast = inject(HqToastService);
  readonly tab = signal<'roles' | 'matrix'>('roles');
  readonly matrixRoleId = signal('role-super-admin');

  readonly breadcrumb = [{ label: 'Permissions' }];

  readonly matrixRoleOptions = computed<HqSelectOption[]>(() =>
    this.data.hqRoles().map((role) => ({ value: role.id, label: role.name })),
  );

  readonly selectedMatrixRole = computed(() =>
    this.data.hqRoles().find((role) => role.id === this.matrixRoleId()),
  );

  readonly levels: PermissionLevel[] = ['none', 'read', 'write', 'full'];

  permissionClass(level: PermissionLevel): string {
    if (level === 'full') return 'hq-badge-active';
    if (level === 'write') return 'hq-badge-trial';
    if (level === 'read') return 'hq-badge-past_due';
    return 'hq-badge-archived';
  }

  setMatrixRole(roleId: string): void {
    this.matrixRoleId.set(roleId);
  }

  cyclePermission(roleId: string, category: PermissionCategoryKey, current: PermissionLevel): void {
    if (!this.perms.canEditPermissions()) {
      this.toast.error('You need write access on Permissions to edit role matrices.', 'Read only');
      return;
    }
    const idx = this.levels.indexOf(current);
    const next = this.levels[(idx + 1) % this.levels.length];
    this.data.updateRolePermission(roleId, category, next);
  }
}
