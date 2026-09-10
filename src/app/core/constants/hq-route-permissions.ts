import { permissionMeets, RoutePermission } from '../utils/permission.utils';
import { PermissionCategoryKey, PermissionLevel } from '../models/hq.models';

/** Resolve minimum permission for a normalized app path (no query string). */
export function resolveRoutePermission(path: string): RoutePermission | null {
  const normalized = path.replace(/\/$/, '') || '/';

  if (normalized === '/' || normalized === '/dashboard' || normalized === '/access-denied') {
    return null;
  }

  if (normalized === '/organizations/new') {
    return { category: 'organizations', min: 'write' };
  }
  if (/^\/organizations\/[^/]+$/.test(normalized)) {
    return { category: 'organizations', min: 'read' };
  }
  if (normalized === '/plans/new') {
    return { category: 'plans', min: 'write' };
  }
  if (/^\/plans\/[^/]+\/edit$/.test(normalized)) {
    return { category: 'plans', min: 'write' };
  }
  if (/^\/plans\/[^/]+$/.test(normalized)) {
    return { category: 'plans', min: 'read' };
  }
  if (/^\/subscriptions\/[^/]+$/.test(normalized)) {
    return { category: 'subscriptions', min: 'read' };
  }
  if (/^\/permissions\/[^/]+$/.test(normalized)) {
    return { category: 'permissions', min: 'read' };
  }
  if (/^\/usage\/[^/]+$/.test(normalized)) {
    return { category: 'usage', min: 'read' };
  }

  const topLevel: Record<string, RoutePermission> = {
    '/organizations': { category: 'organizations', min: 'read' },
    '/users': { category: 'users', min: 'read' },
    '/subscriptions': { category: 'subscriptions', min: 'read' },
    '/billing': { category: 'billing', min: 'read' },
    '/plans': { category: 'plans', min: 'read' },
    '/entitlements': { category: 'features', min: 'read' },
    '/usage': { category: 'usage', min: 'read' },
    '/support': { category: 'support', min: 'read' },
    '/security': { category: 'security', min: 'read' },
    '/permissions': { category: 'permissions', min: 'read' },
    '/notifications': { category: 'settings', min: 'read' },
    '/platform': { category: 'settings', min: 'read' },
  };

  return topLevel[normalized] ?? null;
}

export function canAccessRoute(
  path: string,
  permissions: Record<PermissionCategoryKey, PermissionLevel> | null,
): boolean {
  if (!permissions) return false;
  const required = resolveRoutePermission(path);
  if (!required) return true;
  return permissionMeets(permissions[required.category], required.min);
}
