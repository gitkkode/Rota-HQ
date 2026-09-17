import { HqRole } from './hq.models';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: HqRole | string;
  roleId?: string;
}

export interface StoredAuthUser extends AuthUser {
  password: string;
}

export interface DemoAccount {
  name: string;
  email: string;
  password: string;
  role: HqRole;
  roleId: string;
}

export interface AuthSession {
  userId: string;
  issuedAt: string;
}
