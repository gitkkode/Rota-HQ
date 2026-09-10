import { PermissionCategoryKey, PermissionLevel } from '../models/hq.models';

const LEVEL_RANK: Record<PermissionLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  full: 3,
};

export function permissionMeets(actual: PermissionLevel, required: PermissionLevel): boolean {
  return LEVEL_RANK[actual] >= LEVEL_RANK[required];
}

export interface RoutePermission {
  category: PermissionCategoryKey;
  min: PermissionLevel;
}
