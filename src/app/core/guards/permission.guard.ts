import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { RoutePermission } from '../utils/permission.utils';
import { HqPermissionsService } from '../services/hq-permissions.service';

export const permissionGuard: CanActivateFn = (route) => {
  const perms = inject(HqPermissionsService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const required = route.data['permission'] as RoutePermission | undefined;
  if (!required) {
    return true;
  }

  if (perms.meets(required.category, required.min)) {
    return true;
  }

  return router.createUrlTree(['/access-denied'], {
    queryParams: { returnUrl: route.url.map((s) => s.path).join('/') },
  });
};
