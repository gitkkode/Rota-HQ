import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HQ_NAV_ITEMS } from '../constants/hq-nav.config';
import { canAccessRoute } from '../constants/hq-route-permissions';
import { HqRoleDefinition, PermissionCategoryKey, PermissionLevel } from '../models/hq.models';
import { permissionMeets } from '../utils/permission.utils';
import { HqAuthService } from './hq-auth.service';
import { HqDataService } from './hq-data.service';

@Injectable({ providedIn: 'root' })
export class HqPermissionsService {
  private readonly auth = inject(HqAuthService);
  private readonly data = inject(HqDataService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly currentRole = computed((): HqRoleDefinition | null => {
    this.data.hqRolesEpoch();
    const user = this.auth.currentUser();
    const roles = this.data.hqRoles();
    if (!user) return null;
    return this.resolveRoleForUser(user.roleId, user.role, roles);
  });

  /** Live permissions for the signed-in user's HQ role (reacts to matrix edits). */
  readonly currentPermissions = computed((): Record<PermissionCategoryKey, PermissionLevel> | null => {
    const role = this.currentRole();
    if (!role) return null;
    return { ...role.permissions };
  });

  readonly visibleNavItems = computed(() => {
    const permissions = this.currentPermissions();
    return HQ_NAV_ITEMS.filter((item) => {
      if (!item.permission) return true;
      if (!permissions) return false;
      return permissionMeets(permissions[item.permission], 'read');
    });
  });

  readonly canEditPermissions = computed(() => this.meets('permissions', 'write'));

  constructor() {
    if (!this.isBrowser) return;

    effect(() => {
      const permissions = this.currentPermissions();
      if (!permissions || !this.auth.isAuthenticated()) return;

      const path = this.router.url.split('?')[0];
      if (!canAccessRoute(path, permissions)) {
        void this.router.navigate(['/access-denied'], {
          queryParams: { returnUrl: path },
        });
      }
    });
  }

  meets(category: PermissionCategoryKey, min: PermissionLevel): boolean {
    const permissions = this.currentPermissions();
    if (!permissions) return false;
    return permissionMeets(permissions[category] ?? 'none', min);
  }

  canRead(category: PermissionCategoryKey): boolean {
    return this.meets(category, 'read');
  }

  canWrite(category: PermissionCategoryKey): boolean {
    return this.meets(category, 'write');
  }

  defaultRoute(): string {
    const first = this.visibleNavItems().find((item) => item.path !== '/dashboard');
    return first?.path ?? '/dashboard';
  }

  private resolveRoleForUser(
    roleId: string | undefined,
    roleName: string,
    roles: HqRoleDefinition[],
  ): HqRoleDefinition | null {
    if (roleId) {
      const byId = roles.find((row) => row.id === roleId);
      if (byId) return byId;
    }
    return roles.find((row) => row.name === roleName) ?? null;
  }
}
