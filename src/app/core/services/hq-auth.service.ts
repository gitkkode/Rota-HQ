import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { AuthSession, AuthUser, DemoAccount, StoredAuthUser } from '../models/auth.models';
import { HqRole } from '../models/hq.models';

const SESSION_KEY = 'hq_auth_session';
const USERS_KEY = 'hq_auth_users';

export const DEMO_USERS: StoredAuthUser[] = [
  {
    id: 'hq-admin-1',
    name: 'Oda Dink',
    email: 'oda@workforce.hq',
    password: 'Workforce123!',
    role: 'Super Admin',
    roleId: 'role-super-admin',
  },
  {
    id: 'hq-admin-2',
    name: 'Paul Platform',
    email: 'platform@workforce.hq',
    password: 'Workforce123!',
    role: 'Platform Admin',
    roleId: 'role-platform-admin',
  },
  {
    id: 'hq-admin-3',
    name: 'Priya Billing',
    email: 'billing@workforce.hq',
    password: 'Workforce123!',
    role: 'Billing Admin',
    roleId: 'role-billing-admin',
  },
  {
    id: 'hq-admin-4',
    name: 'Sam Support',
    email: 'support@workforce.hq',
    password: 'Workforce123!',
    role: 'Support Admin',
    roleId: 'role-support-admin',
  },
  {
    id: 'hq-admin-5',
    name: 'Sara Security',
    email: 'security@workforce.hq',
    password: 'Workforce123!',
    role: 'Security Admin',
    roleId: 'role-security-admin',
  },
  {
    id: 'hq-admin-6',
    name: 'Vik Viewer',
    email: 'viewer@workforce.hq',
    password: 'Workforce123!',
    role: 'HQ Viewer',
    roleId: 'role-hq-viewer',
  },
];

const DEMO_EMAILS = new Set(DEMO_USERS.map((user) => user.email.toLowerCase()));

@Injectable({ providedIn: 'root' })
export class HqAuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly session = signal<AuthSession | null>(this.readSession());
  private readonly users = signal<StoredAuthUser[]>(this.readUsers());

  readonly demoAccounts: DemoAccount[] = DEMO_USERS.map((user) => ({
    name: user.name,
    email: user.email,
    password: user.password,
    role: user.role as HqRole,
    roleId: user.roleId!,
  }));

  readonly currentUser = computed<AuthUser | null>(() => {
    const session = this.session();
    if (!session) return null;
    const user = this.users().find((row) => row.id === session.userId);
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleId: user.roleId,
    };
  });

  readonly isAuthenticated = computed(() => !!this.session() && !!this.currentUser());

  readonly initials = computed(() => {
    const user = this.currentUser();
    if (!user) return 'HQ';
    return user.name
      .split(' ')
      .map((part) => part[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  });

  readonly firstName = computed(() => {
    const user = this.currentUser();
    if (!user) return 'there';
    return user.name.split(' ')[0] ?? user.name;
  });

  login(email: string, password: string): { ok: true } | { ok: false; message: string } {
    this.users.set(this.readUsers());

    const normalized = email.trim().toLowerCase();
    const user = this.users().find((row) => row.email.toLowerCase() === normalized);
    if (!user || user.password !== password) {
      return { ok: false, message: 'Invalid email or password.' };
    }

    this.persistSession(user.id);
    return { ok: true };
  }

  register(
    name: string,
    email: string,
    password: string,
  ): { ok: true } | { ok: false; message: string } {
    const trimmedName = name.trim();
    const normalized = email.trim().toLowerCase();

    if (!trimmedName) {
      return { ok: false, message: 'Name is required.' };
    }
    if (!normalized || !normalized.includes('@')) {
      return { ok: false, message: 'Enter a valid email address.' };
    }
    if (password.length < 8) {
      return { ok: false, message: 'Password must be at least 8 characters.' };
    }
    if (this.users().some((row) => row.email.toLowerCase() === normalized)) {
      return { ok: false, message: 'An account with this email already exists.' };
    }

    const user: StoredAuthUser = {
      id: `hq-user-${Date.now()}`,
      name: trimmedName,
      email: normalized,
      password,
      role: 'Platform Admin',
      roleId: 'role-platform-admin',
    };

    this.users.update((rows) => [...rows, user]);
    this.writeUsers(this.users());
    this.persistSession(user.id);
    return { ok: true };
  }

  requestPasswordReset(email: string): { ok: true } | { ok: false; message: string } {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      return { ok: false, message: 'Enter a valid email address.' };
    }
    const exists = this.users().some((row) => row.email.toLowerCase() === normalized);
    if (!exists) {
      return { ok: false, message: 'No account found for that email address.' };
    }
    return { ok: true };
  }

  logout(): void {
    this.session.set(null);
    if (this.isBrowser) {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  private persistSession(userId: string): void {
    const next: AuthSession = { userId, issuedAt: new Date().toISOString() };
    this.session.set(next);
    if (this.isBrowser) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    }
  }

  private readSession(): AuthSession | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  }

  private readUsers(): StoredAuthUser[] {
    const byEmail = new Map<string, StoredAuthUser>();
    for (const user of DEMO_USERS) {
      byEmail.set(user.email.toLowerCase(), { ...user });
    }

    if (!this.isBrowser) {
      return [...byEmail.values()];
    }

    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (!raw) return [...byEmail.values()];
      const stored = JSON.parse(raw) as StoredAuthUser[];
      for (const user of stored) {
        const key = user.email.toLowerCase();
        if (!DEMO_EMAILS.has(key) && !byEmail.has(key)) {
          byEmail.set(key, user);
        }
      }
    } catch {
      // ignore corrupt storage
    }

    return [...byEmail.values()];
  }

  private writeUsers(users: StoredAuthUser[]): void {
    if (!this.isBrowser) return;
    const extra = users.filter((row) => !DEMO_EMAILS.has(row.email.toLowerCase()));
    localStorage.setItem(USERS_KEY, JSON.stringify(extra));
  }
}
