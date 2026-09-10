import { HQ_ROLES } from '../data/mock-hq.data';
import { HqRoleDefinition } from '../models/hq.models';

export const HQ_ROLES_STORAGE_KEY = 'hq_roles_matrix';

export function mergeHqRoles(stored: HqRoleDefinition[]): HqRoleDefinition[] {
  const byId = new Map(stored.map((role) => [role.id, role]));
  return HQ_ROLES.map((role) => {
    const saved = byId.get(role.id);
    return saved ? { ...role, ...saved, permissions: { ...saved.permissions } } : { ...role };
  });
}

export function loadHqRolesFromStorage(read: (key: string) => string | null): HqRoleDefinition[] {
  try {
    const raw = read(HQ_ROLES_STORAGE_KEY);
    if (!raw) return HQ_ROLES.map((role) => ({ ...role, permissions: { ...role.permissions } }));
    const stored = JSON.parse(raw) as HqRoleDefinition[];
    if (!Array.isArray(stored) || !stored.length) {
      return HQ_ROLES.map((role) => ({ ...role, permissions: { ...role.permissions } }));
    }
    return mergeHqRoles(stored);
  } catch {
    return HQ_ROLES.map((role) => ({ ...role, permissions: { ...role.permissions } }));
  }
}
