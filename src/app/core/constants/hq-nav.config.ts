import { PermissionCategoryKey } from '../models/hq.models';

export interface HqNavItem {
  label: string;
  path: string;
  icon: string;
  /** When omitted, any authenticated HQ user can see this item (e.g. Dashboard). */
  permission?: PermissionCategoryKey;
}

export const HQ_NAV_ITEMS: HqNavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
  { label: 'Organizations', path: '/organizations', icon: 'orgs', permission: 'organizations' },
  { label: 'Users & Admins', path: '/users', icon: 'users', permission: 'users' },
  { label: 'Subscriptions', path: '/subscriptions', icon: 'subs', permission: 'subscriptions' },
  { label: 'Billing', path: '/billing', icon: 'billing', permission: 'billing' },
  { label: 'Plans & Features', path: '/plans', icon: 'plans', permission: 'plans' },
  { label: 'Entitlements', path: '/entitlements', icon: 'entitlements', permission: 'features' },
  { label: 'Usage', path: '/usage', icon: 'usage', permission: 'usage' },
  { label: 'Support', path: '/support', icon: 'support', permission: 'support' },
  { label: 'Security', path: '/security', icon: 'security', permission: 'security' },
  { label: 'Permissions', path: '/permissions', icon: 'permissions', permission: 'permissions' },
  { label: 'Notifications', path: '/notifications', icon: 'bell', permission: 'settings' },
  { label: 'Platform Settings', path: '/platform', icon: 'settings', permission: 'settings' },
];
