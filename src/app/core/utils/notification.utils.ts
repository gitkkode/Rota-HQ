import { HqNotification } from '../models/hq.models';

/** Routine events Super Admins should not see in their inbox. */
const SUPER_ADMIN_ROUTINE_KINDS = new Set<HqNotification['kind']>([
  'org_created',
  'subscription_ended',
  'trial_ended',
]);

export function isImportantForSuperAdmin(notification: HqNotification): boolean {
  return !SUPER_ADMIN_ROUTINE_KINDS.has(notification.kind);
}

export function filterNotificationsForRole(
  notifications: HqNotification[],
  role: string | undefined,
): HqNotification[] {
  if (role === 'Super Admin') {
    return notifications.filter(isImportantForSuperAdmin);
  }
  return notifications;
}
