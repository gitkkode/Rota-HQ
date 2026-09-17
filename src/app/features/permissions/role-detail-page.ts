import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HqDataService } from '../../core/services/hq-data.service';
import { HqPermissionsService } from '../../core/services/hq-permissions.service';
import { PermissionCategoryKey, PermissionLevel } from '../../core/models/hq.models';
import { HqBreadcrumbs } from '../../shared/hq-breadcrumbs';
import { HqToastService } from '../../shared/hq-toast.service';

@Component({
  selector: 'app-role-detail-page',
  imports: [RouterLink, DatePipe, HqBreadcrumbs],
  templateUrl: './role-detail-page.html',
  styleUrl: './role-detail-page.scss',
})
export class RoleDetailPage {
  readonly data = inject(HqDataService);
  readonly perms = inject(HqPermissionsService);
  private readonly toast = inject(HqToastService);
  private readonly route = inject(ActivatedRoute);

  private readonly roleId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );

  readonly role = computed(() => this.data.hqRoles().find((row) => row.id === this.roleId()));

  readonly breadcrumb = computed(() => [
    { label: 'Permissions', link: '/permissions' },
    { label: this.role()?.name ?? 'Role detail' },
  ]);

  readonly levels: PermissionLevel[] = ['none', 'read', 'write', 'full'];

  permissionClass(level: PermissionLevel): string {
    if (level === 'full') return 'hq-badge-active';
    if (level === 'write') return 'hq-badge-trial';
    if (level === 'read') return 'hq-badge-past_due';
    return 'hq-badge-archived';
  }

  cyclePermission(category: PermissionCategoryKey, current: PermissionLevel): void {
    if (!this.perms.canEditPermissions()) {
      this.toast.error('You need write access on Permissions to edit role matrices.', 'Read only');
      return;
    }
    const role = this.role();
    if (!role) return;
    const idx = this.levels.indexOf(current);
    const next = this.levels[(idx + 1) % this.levels.length];
    this.data.updateRolePermission(role.id, category, next);
  }
}
