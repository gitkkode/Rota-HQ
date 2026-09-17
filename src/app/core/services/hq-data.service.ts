import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HqToastService } from '../../shared/hq-toast.service';
import {
  ACTIVE_SESSIONS,
  ADMINS,
  AUDIT_EVENTS,
  FEATURES,
  FEATURE_FLAGS,
  GLOBAL_USERS,
  GROWTH_TREND,
  HQ_ROLES,
  INTEGRATIONS,
  INVOICES,
  NOTIFICATIONS,
  NOTIFICATION_TEMPLATES,
  ORG_FEATURE_OVERRIDES,
  ORGANIZATIONS,
  PAYMENTS,
  PAYMENT_GATEWAY,
  PERMISSION_CATEGORIES,
  PLAN_CHANGES,
  PLANS,
  PLATFORM_ALERTS,
  PLATFORM_SETTINGS,
  RECENT_ACTIVITY,
  SECURITY_ALERTS,
  SIGN_IN_ACTIVITY,
  SUBSCRIPTIONS,
  SUPPORT_SESSIONS,
} from '../data/mock-hq.data';
import {
  ActiveSession,
  AdminUser,
  AuditEvent,
  FeatureFlag,
  GlobalUser,
  HqNotification,
  HqRoleDefinition,
  IntegrationPlaceholder,
  Invoice,
  NotificationTemplate,
  OrgFeatureOverride,
  Organization,
  OrgStatus,
  Payment,
  PaymentGatewayConfig,
  PermissionCategory,
  PermissionCategoryKey,
  PermissionLevel,
  Plan,
  PlanChangeRecord,
  PlanInterval,
  PlatformSettings,
  SecurityAlertItem,
  SignInActivity,
  Subscription,
  SubscriptionStatus,
  SupportSession,
} from '../models/hq.models';
import { HqAuthService } from './hq-auth.service';
import { filterNotificationsForRole } from '../utils/notification.utils';
import {
  PaymentDetailView,
  InvoiceDetailView,
  buildInvoiceLineItems,
  computeInvoiceTax,
} from '../utils/billing-detail.util';
import { buildInvoicePdf } from '../utils/invoice-pdf.util';
import { formatHqCurrency, HQ_CURRENCY } from '../constants/currency.constants';
import { permissionMeets } from '../utils/permission.utils';
import {
  HQ_ROLES_STORAGE_KEY,
  loadHqRolesFromStorage,
} from '../utils/hq-roles.storage';

@Injectable({ providedIn: 'root' })
export class HqDataService {
  private readonly toast = inject(HqToastService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly auth = inject(HqAuthService);

  private readonly hqRolesEpochSignal = signal(0);
  private readonly hqRolesSignal = signal<HqRoleDefinition[]>(this.bootstrapHqRoles());
  private readonly adminsSignal = signal<AdminUser[]>([...ADMINS]);
  private readonly subscriptionsSignal = signal<Subscription[]>([...SUBSCRIPTIONS]);
  private readonly plansSignal = signal<Plan[]>([...PLANS]);
  private readonly globalUsersSignal = signal<GlobalUser[]>([...GLOBAL_USERS]);
  private readonly sessionsSignal = signal<ActiveSession[]>([...ACTIVE_SESSIONS]);
  private readonly auditSignal = signal<AuditEvent[]>([...AUDIT_EVENTS]);
  private readonly planChangesSignal = signal<PlanChangeRecord[]>([...PLAN_CHANGES]);
  private readonly supportSessionsSignal = signal<SupportSession[]>([...SUPPORT_SESSIONS]);
  private readonly notificationsSignal = signal<HqNotification[]>([...NOTIFICATIONS]);
  private readonly featureFlagsSignal = signal<FeatureFlag[]>([...FEATURE_FLAGS]);
  private readonly platformSettingsSignal = signal<PlatformSettings>({ ...PLATFORM_SETTINGS });
  private readonly organizationsSignal = signal<Organization[]>([...ORGANIZATIONS]);
  private readonly featureOverridesSignal = signal<OrgFeatureOverride[]>([...ORG_FEATURE_OVERRIDES]);
  private readonly invoicesSignal = signal<Invoice[]>([...INVOICES]);
  private readonly paymentsSignal = signal<Payment[]>([...PAYMENTS]);
  private readonly integrationsSignal = signal<IntegrationPlaceholder[]>([...INTEGRATIONS]);
  private readonly notificationTemplatesSignal = signal<NotificationTemplate[]>([...NOTIFICATION_TEMPLATES]);
  private readonly paymentGatewaySignal = signal<PaymentGatewayConfig>({ ...PAYMENT_GATEWAY });

  readonly organizations = this.organizationsSignal.asReadonly();
  readonly admins = this.adminsSignal.asReadonly();
  readonly subscriptions = this.subscriptionsSignal.asReadonly();
  readonly plans = this.plansSignal.asReadonly();
  readonly globalUsers = this.globalUsersSignal.asReadonly();
  readonly activeSessions = this.sessionsSignal.asReadonly();
  readonly auditEvents = this.auditSignal.asReadonly();
  readonly planChanges = this.planChangesSignal.asReadonly();
  readonly supportSessions = this.supportSessionsSignal.asReadonly();
  readonly notifications = this.notificationsSignal.asReadonly();
  readonly featureFlags = this.featureFlagsSignal.asReadonly();
  readonly platformSettings = this.platformSettingsSignal.asReadonly();
  readonly hqRoles = this.hqRolesSignal.asReadonly();
  readonly hqRolesEpoch = this.hqRolesEpochSignal.asReadonly();
  readonly featureOverrides = this.featureOverridesSignal.asReadonly();
  readonly invoices = this.invoicesSignal.asReadonly();
  readonly payments = this.paymentsSignal.asReadonly();
  readonly features = FEATURES;
  readonly permissionCategories = PERMISSION_CATEGORIES;
  readonly integrations = this.integrationsSignal.asReadonly();
  readonly notificationTemplates = this.notificationTemplatesSignal.asReadonly();
  readonly paymentGateway = this.paymentGatewaySignal.asReadonly();
  readonly signInActivity = SIGN_IN_ACTIVITY;
  readonly securityAlerts = SECURITY_ALERTS;
  readonly recentActivity = RECENT_ACTIVITY;
  readonly platformAlerts = PLATFORM_ALERTS;
  readonly growthTrend = GROWTH_TREND;

  readonly visibleNotifications = computed(() =>
    filterNotificationsForRole(this.notificationsSignal(), this.auth.currentUser()?.role),
  );

  readonly unreadNotificationCount = computed(
    () => this.visibleNotifications().filter((n) => !n.read).length,
  );

  readonly activeSupportSession = computed(
    () => this.supportSessionsSignal().find((s) => s.status === 'active') ?? null,
  );

  readonly kpis = computed(() => {
    const orgs = this.organizationsSignal();
    const totalUsers = orgs.reduce((sum, o) => sum + o.userCount, 0);
    const mrr = orgs.reduce((sum, o) => sum + o.mrr, 0);
    const failedPayments = orgs.filter((o) => o.status === 'past_due').length;
    const nearLimit = orgs.filter((o) => {
      const userPct = o.usage.users / o.usage.usersLimit;
      const locPct = o.usage.locations / o.usage.locationsLimit;
      return userPct >= 0.85 || locPct >= 0.85;
    }).length;

    return {
      totalOrganizations: orgs.length,
      activeOrganizations: orgs.filter((o) => o.status === 'active').length,
      trialOrganizations: orgs.filter((o) => o.status === 'trial').length,
      totalUsers,
      mrr,
      subscriptionHealth: Math.round(
        (orgs.filter((o) => o.subscriptionStatus === 'active' || o.subscriptionStatus === 'trial')
          .length /
          orgs.length) *
          100,
      ),
      failedPayments,
      nearLimit,
    };
  });

  readonly attentionOrganizations = computed(() =>
    this.organizationsSignal().filter((o) =>
      ['past_due', 'suspended', 'trial'].includes(o.status),
    ),
  );

  readonly recentSignups = computed(() =>
    [...this.organizationsSignal()]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 5),
  );

  readonly recentSubscriptionChanges = computed(() =>
    [...this.planChangesSignal()]
      .sort((a, b) => +new Date(b.changedAt) - +new Date(a.changedAt))
      .slice(0, 5),
  );

  readonly platformHealth = computed(() => {
    const settings = this.platformSettingsSignal();
    const critical = this.platformAlerts.filter((a) => a.severity === 'critical').length;
    if (settings.maintenanceMode) return { label: 'Maintenance mode', tone: 'warn' as const };
    if (critical > 0) return { label: `${critical} critical alert(s)`, tone: 'danger' as const };
    return { label: 'All systems operational', tone: 'ok' as const };
  });

  readonly usageRows = computed(() =>
    this.organizationsSignal().map((org) => {
      const userRatio = org.usage.users / org.usage.usersLimit;
      const locationRatio = org.usage.locations / org.usage.locationsLimit;
      const managerRatio = org.usage.managers / org.usage.managersLimit;
      const storageRatio = org.usage.storageGb / org.usage.storageLimitGb;
      const maxRatio = Math.max(userRatio, locationRatio, managerRatio, storageRatio);
      const tone = maxRatio >= 1 ? 'limit' : maxRatio >= 0.85 ? 'near' : 'healthy';
      return { org, userRatio, locationRatio, managerRatio, storageRatio, maxRatio, tone };
    }),
  );

  getOrganization(id: string): Organization | undefined {
    return this.organizationsSignal().find((o) => o.id === id);
  }

  getPlan(id: string): Plan | undefined {
    return this.plansSignal().find((p) => p.id === id);
  }

  getSubscription(id: string): Subscription | undefined {
    return this.subscriptionsSignal().find((s) => s.id === id);
  }

  getPrimaryAdmin(orgId: string): AdminUser | undefined {
    const org = this.getOrganization(orgId);
    if (!org) return undefined;
    return this.adminsSignal().find((a) => a.id === org.primaryAdminId);
  }

  getAdminsForOrg(orgId: string): AdminUser[] {
    return this.adminsSignal().filter((a) => a.organizationId === orgId);
  }

  getSubscriptionForOrg(orgId: string): Subscription | undefined {
    return this.subscriptionsSignal().find((s) => s.organizationId === orgId);
  }

  getPlanChangesForSubscription(subscriptionId: string): PlanChangeRecord[] {
    return this.planChangesSignal().filter((c) => c.subscriptionId === subscriptionId);
  }

  getHqRole(id: string): HqRoleDefinition | undefined {
    return this.hqRolesSignal().find((r) => r.id === id);
  }

  getHqRoleByName(name: string): HqRoleDefinition | undefined {
    return this.hqRolesSignal().find((r) => r.name === name);
  }

  getInvoicesForSubscription(subscriptionId: string): Invoice[] {
    return this.invoicesSignal()
      .filter((inv) => inv.subscriptionId === subscriptionId)
      .sort((a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt));
  }

  getInvoicesForOrg(orgId: string): Invoice[] {
    return this.invoicesSignal()
      .filter((inv) => inv.organizationId === orgId)
      .sort((a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt));
  }

  getPaymentsForInvoice(invoiceId: string): Payment[] {
    return this.paymentsSignal().filter((p) => p.invoiceId === invoiceId);
  }

  getOrgFeatureOverrides(orgId: string): OrgFeatureOverride[] {
    return this.featureOverridesSignal().filter((o) => o.organizationId === orgId);
  }

  getEffectiveFeaturesForOrg(orgId: string): Array<{ feature: (typeof FEATURES)[0]; source: 'plan' | 'override'; enabled: boolean }> {
    const org = this.getOrganization(orgId);
    if (!org) return [];
    const plan = this.getPlan(org.planId);
    if (!plan) return [];
    const overrides = this.getOrgFeatureOverrides(orgId);
    const overrideMap = new Map(overrides.map((o) => [o.featureId, o]));

    return this.features.map((feature) => {
      const override = overrideMap.get(feature.id);
      const inPlan = plan.featureIds.includes(feature.id);
      if (override) {
        return { feature, source: 'override' as const, enabled: override.enabled };
      }
      return { feature, source: 'plan' as const, enabled: inPlan };
    });
  }

  getOrgActivity(orgId: string): AuditEvent[] {
    const org = this.getOrganization(orgId);
    if (!org) return [];
    return this.auditSignal()
      .filter((e) => e.target === org.name || e.description.includes(org.name))
      .slice(0, 20);
  }

  getAuditForUser(email: string): AuditEvent[] {
    const local = email.split('@')[0].toLowerCase();
    const mail = email.toLowerCase();
    return this.auditSignal()
      .filter(
        (e) =>
          e.actor.toLowerCase().includes(local) ||
          e.description.toLowerCase().includes(mail) ||
          e.description.toLowerCase().includes(local),
      )
      .slice(0, 10);
  }

  getSignInForUser(email: string): SignInActivity[] {
    const mail = email.toLowerCase();
    return SIGN_IN_ACTIVITY.filter((s) => s.email.toLowerCase() === mail).sort(
      (a, b) => +new Date(b.timestamp) - +new Date(a.timestamp),
    );
  }

  readonly billingSummary = computed(() => {
    const invoices = this.invoicesSignal();
    const payments = this.paymentsSignal();
    return {
      totalRevenue: payments.filter((p) => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0),
      openInvoices: invoices.filter((i) => i.status === 'open' || i.status === 'past_due').length,
      failedPayments: payments.filter((p) => p.status === 'failed').length,
      refunded: payments.filter((p) => p.status === 'refunded').length,
    };
  });

  readonly billingActivity = computed(() =>
    this.auditSignal()
      .filter((e) => e.category === 'Billing' || e.category === 'Subscriptions')
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)),
  );

  readonly entitlementActivity = computed(() =>
    this.auditSignal()
      .filter((e) => e.category === 'Entitlements' || e.action.includes('Feature'))
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)),
  );

  updateRolePermission(roleId: string, category: PermissionCategoryKey, level: PermissionLevel): void {
    const actor = this.getHqRoleByName(this.auth.currentUser()?.role ?? '');
    const actorById = this.auth.currentUser()?.roleId
      ? this.getHqRole(this.auth.currentUser()!.roleId!)
      : undefined;
    const actorRole = actorById ?? actor;
    if (!actorRole || !permissionMeets(actorRole.permissions.permissions, 'write')) {
      this.toast.error('You do not have permission to modify HQ roles.', 'Access denied');
      return;
    }

    this.hqRolesSignal.update((list) =>
      list.map((role) =>
        role.id === roleId
          ? {
              ...role,
              permissions: { ...role.permissions, [category]: level },
              updatedAt: new Date().toISOString().slice(0, 10),
            }
          : role,
      ),
    );
    this.hqRolesEpochSignal.update((value) => value + 1);
    this.persistHqRoles();
    const role = this.getHqRole(roleId);
    if (role) {
      const cat = PERMISSION_CATEGORIES.find((c) => c.key === category);
      this.pushAudit({
        actor: 'Oda Dink',
        action: 'Permission Updated',
        target: role.name,
        category: 'Permissions',
        result: 'success',
        description: `${cat?.label ?? category} set to ${level}.`,
      });
      this.toast.success(`${role.name}: ${cat?.label ?? category} → ${level}.`, 'Permission updated');
    }
  }

  setOrgFeatureOverride(payload: {
    organizationId: string;
    featureId: string;
    enabled: boolean;
    reason: string;
  }): void {
    const org = this.getOrganization(payload.organizationId);
    const feature = this.features.find((f) => f.id === payload.featureId);
    const now = new Date().toISOString().slice(0, 10);
    const existing = this.featureOverridesSignal().find(
      (o) => o.organizationId === payload.organizationId && o.featureId === payload.featureId,
    );

    if (existing) {
      this.featureOverridesSignal.update((list) =>
        list.map((item) =>
          item.organizationId === payload.organizationId && item.featureId === payload.featureId
            ? {
                ...item,
                enabled: payload.enabled,
                reason: payload.reason,
                updatedAt: now,
                updatedBy: 'Oda Dink',
              }
            : item,
        ),
      );
    } else {
      this.featureOverridesSignal.update((list) => [
        ...list,
        {
          organizationId: payload.organizationId,
          featureId: payload.featureId,
          enabled: payload.enabled,
          reason: payload.reason,
          updatedAt: now,
          updatedBy: 'Oda Dink',
        },
      ]);
    }

    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Feature Access Changed',
      target: org?.name ?? payload.organizationId,
      category: 'Features',
      result: 'success',
      description: `${feature?.name ?? payload.featureId} ${payload.enabled ? 'enabled' : 'disabled'}. ${payload.reason}`,
    });
    this.toast.success(
      `${feature?.name ?? 'Feature'} ${payload.enabled ? 'enabled' : 'disabled'} for ${org?.name ?? 'organization'}.`,
      'Feature access updated',
    );
  }

  removeOrgFeatureOverride(organizationId: string, featureId: string): void {
    const org = this.getOrganization(organizationId);
    const feature = this.features.find((f) => f.id === featureId);
    this.featureOverridesSignal.update((list) =>
      list.filter((o) => !(o.organizationId === organizationId && o.featureId === featureId)),
    );
    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Feature Override Removed',
      target: org?.name ?? organizationId,
      category: 'Features',
      result: 'success',
      description: `${feature?.name ?? featureId} reverted to plan defaults.`,
    });
    this.toast.success(`${feature?.name ?? 'Feature'} override removed.`, 'Override cleared');
  }

  resendAdminInvitation(adminId: string): void {
    const admin = this.adminsSignal().find((a) => a.id === adminId);
    if (!admin || admin.status !== 'invited') return;
    const org = this.getOrganization(admin.organizationId);
    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Invitation Resent',
      target: org?.name ?? admin.email,
      category: 'Users',
      result: 'success',
      description: `Invitation resent to ${admin.email}.`,
    });
    this.toast.success(`Invitation resent to ${admin.email}.`, 'Invitation sent');
  }

  cancelOrganization(id: string, reason: string): void {
    this.updateOrganizationStatus(id, 'cancelled', reason);
  }

  archiveOrganization(id: string, reason: string): void {
    this.updateOrganizationStatus(id, 'archived', reason);
  }

  getOrgsOnPlan(planId: string): Organization[] {
    return this.organizationsSignal().filter((o) => o.planId === planId);
  }

  private pushAudit(partial: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const event: AuditEvent = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...partial,
    };
    this.auditSignal.update((list) => [event, ...list]);
  }

  updateOrganizationStatus(id: string, status: OrgStatus, reason?: string): void {
    const org = this.getOrganization(id);
    this.organizationsSignal.update((list) =>
      list.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              subscriptionStatus:
                status === 'suspended' || status === 'cancelled' || status === 'archived'
                  ? status === 'archived'
                    ? 'cancelled'
                    : status
                  : item.subscriptionStatus,
              lastActivityAt: new Date().toISOString(),
            }
          : item,
      ),
    );

    if (org) {
      this.subscriptionsSignal.update((list) =>
        list.map((sub) =>
          sub.organizationId === id
            ? {
                ...sub,
                status:
                  status === 'archived'
                    ? 'cancelled'
                    : (status as SubscriptionStatus),
              }
            : sub,
        ),
      );
      this.pushAudit({
        actor: 'Oda Dink',
        action: `Organization ${status.replace('_', ' ')}`,
        target: org.name,
        category: 'Organizations',
        result: 'success',
        description: reason || `Organization status set to ${status}.`,
      });
      const statusLabel = status.replace('_', ' ');
      if (status === 'suspended' || status === 'cancelled' || status === 'archived') {
        this.toast.warning(`${org.name} is now ${statusLabel}.`, 'Organization updated');
      } else {
        this.toast.success(`${org.name} is now ${statusLabel}.`, 'Organization updated');
      }
    }
  }

  changeSubscriptionPlan(
    subscriptionId: string,
    newPlanId: string,
    note: string,
    options?: { scheduleAtPeriodEnd?: boolean },
  ): void {
    const sub = this.getSubscription(subscriptionId);
    const newPlan = this.getPlan(newPlanId);
    const currentPlan = sub ? this.getPlan(sub.planId) : undefined;
    if (!sub || !newPlan || !currentPlan) return;

    const isDowngrade = newPlan.priceMonthly < currentPlan.priceMonthly;
    if (options?.scheduleAtPeriodEnd || isDowngrade) {
      this.schedulePlanChange(subscriptionId, newPlanId, note);
      return;
    }

    const fromPlanId = sub.planId;
    this.subscriptionsSignal.update((list) =>
      list.map((item) =>
        item.id === subscriptionId
          ? {
              ...item,
              planId: newPlanId,
              seats: newPlan.seatsIncluded,
              amount: newPlan.priceMonthly,
              interval: newPlan.interval,
              status: item.status === 'trial' ? 'trial' : 'active',
              paymentStatus: item.status === 'trial' ? 'n/a' : 'paid',
              pendingPlanChange: undefined,
            }
          : item,
      ),
    );

    this.organizationsSignal.update((list) =>
      list.map((org) =>
        org.id === sub.organizationId
          ? {
              ...org,
              planId: newPlanId,
              mrr: org.status === 'trial' ? 0 : newPlan.priceMonthly,
              usage: {
                ...org.usage,
                usersLimit: newPlan.seatsIncluded,
                locationsLimit: newPlan.locationsIncluded,
              },
              lastActivityAt: new Date().toISOString(),
            }
          : org,
      ),
    );

    this.planChangesSignal.update((list) => [
      {
        id: `pc-${Date.now()}`,
        subscriptionId,
        fromPlanId,
        toPlanId: newPlanId,
        changedAt: new Date().toISOString(),
        changedBy: 'Oda Dink',
        note,
      },
      ...list,
    ]);

    const org = this.getOrganization(sub.organizationId);
    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Plan Updated',
      target: org?.name ?? subscriptionId,
      category: 'Subscriptions',
      result: 'success',
      description: note || `Plan changed to ${newPlan.name}.`,
    });
    this.toast.success(
      `${org?.name ?? 'Subscription'} moved to ${newPlan.name}.`,
      'Plan updated',
    );
  }

  inviteAdmin(payload: {
    organizationId: string;
    name: string;
    email: string;
    role: string;
  }): void {
    const colors = ['#4b22b3', '#3b82f6', '#14b8a6', '#f97316', '#ec4899', '#84cc16'];
    const admin: AdminUser = {
      id: `adm-${Date.now()}`,
      name: payload.name,
      email: payload.email,
      organizationId: payload.organizationId,
      role: payload.role,
      status: 'invited',
      lastActiveAt: new Date().toISOString(),
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
    };
    this.adminsSignal.update((list) => [admin, ...list]);
    this.globalUsersSignal.update((list) => [
      {
        id: `gu-${admin.id}`,
        name: admin.name,
        email: admin.email,
        organizationId: admin.organizationId,
        role: 'Admin',
        status: 'invited',
        lastActiveAt: admin.lastActiveAt,
      },
      ...list,
    ]);

    const org = this.getOrganization(payload.organizationId);
    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Admin Invited',
      target: org?.name ?? payload.organizationId,
      category: 'Users',
      result: 'success',
      description: `Invitation sent to ${payload.email}.`,
    });
    this.toast.success(
      `Invitation sent to ${payload.email}.`,
      org ? `Admin invited · ${org.name}` : 'Admin invited',
    );
  }

  setAdminStatus(adminId: string, status: AdminUser['status']): void {
    const admin = this.adminsSignal().find((a) => a.id === adminId);
    this.adminsSignal.update((list) =>
      list.map((item) => (item.id === adminId ? { ...item, status } : item)),
    );
    this.globalUsersSignal.update((list) =>
      list.map((item) =>
        item.email === admin?.email ? { ...item, status } : item,
      ),
    );
    if (admin) {
      const org = this.getOrganization(admin.organizationId);
      this.pushAudit({
        actor: 'Oda Dink',
        action: status === 'active' ? 'Admin Reactivated' : 'Admin Deactivated',
        target: org?.name ?? admin.email,
        category: 'Users',
        result: 'success',
        description: `${admin.name} marked as ${status}.`,
      });
      this.toast.success(
        `${admin.name} is now ${status}.`,
        status === 'active' ? 'Admin reactivated' : 'Admin updated',
      );
    }
  }

  revokeSession(sessionId: string): void {
    const session = this.sessionsSignal().find((s) => s.id === sessionId);
    this.sessionsSignal.update((list) => list.filter((s) => s.id !== sessionId));
    if (session) {
      this.pushAudit({
        actor: 'Oda Dink',
        action: 'Session Revoked',
        target: session.userName,
        category: 'Security',
        result: 'warning',
        description: `Session revoked for ${session.email} (${session.device}).`,
      });
      this.toast.warning(
        `Session ended for ${session.userName} (${session.device}).`,
        'Session revoked',
      );
    }
  }

  startSupportSession(payload: {
    organizationId: string;
    targetUserName: string;
    targetUserEmail: string;
    reason: string;
    durationMinutes?: number;
  }): void {
    const existing = this.activeSupportSession();
    if (existing) {
      this.endSupportSession(existing.id);
    }

    const minutes = payload.durationMinutes ?? 60;
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + minutes * 60_000);
    const session: SupportSession = {
      id: `sup-${Date.now()}`,
      organizationId: payload.organizationId,
      targetUserName: payload.targetUserName,
      targetUserEmail: payload.targetUserEmail,
      operatorName: 'Oda Dink',
      reason: payload.reason,
      status: 'active',
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };

    this.supportSessionsSignal.update((list) => [session, ...list]);

    const org = this.getOrganization(payload.organizationId);
    this.sessionsSignal.update((list) => [
      {
        id: `ses-support-${Date.now()}`,
        userName: 'Oda Dink',
        email: 'oda@workforce.hq',
        role: 'Support Session',
        organizationName: org?.name ?? null,
        location: 'HQ Support',
        device: 'Chrome · Windows',
        ip: '81.2.69.142',
        startedAt: session.startedAt,
        lastSeenAt: session.startedAt,
        risk: 'medium',
      },
      ...list,
    ]);

    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Support Session Started',
      target: org?.name ?? payload.organizationId,
      category: 'Support',
      result: 'warning',
      description: payload.reason,
    });
    this.toast.info(
      `Support access granted for ${payload.targetUserEmail}.`,
      org ? `Session started · ${org.name}` : 'Support session started',
    );
  }

  endSupportSession(sessionId: string): void {
    const session = this.supportSessionsSignal().find((s) => s.id === sessionId);
    if (!session || session.status !== 'active') return;

    this.supportSessionsSignal.update((list) =>
      list.map((item) =>
        item.id === sessionId
          ? { ...item, status: 'ended', endedAt: new Date().toISOString() }
          : item,
      ),
    );

    this.sessionsSignal.update((list) =>
      list.filter((s) => !(s.role === 'Support Session' && s.email === 'oda@workforce.hq')),
    );

    const org = this.getOrganization(session.organizationId);
    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Support Session Ended',
      target: org?.name ?? session.organizationId,
      category: 'Support',
      result: 'success',
      description: `Support access closed for ${session.targetUserEmail}.`,
    });
    this.toast.success(
      `Support access closed for ${session.targetUserEmail}.`,
      'Session ended',
    );
  }

  markNotificationRead(id: string): void {
    this.notificationsSignal.update((list) =>
      list.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
  }

  markAllNotificationsRead(): void {
    const visibleIds = new Set(this.visibleNotifications().map((item) => item.id));
    this.notificationsSignal.update((list) =>
      list.map((item) => (visibleIds.has(item.id) ? { ...item, read: true } : item)),
    );
    this.toast.success('All notifications marked as read.', 'Inbox updated');
  }

  toggleFeatureFlag(id: string): void {
    this.featureFlagsSignal.update((list) =>
      list.map((flag) =>
        flag.id === id
          ? {
              ...flag,
              enabled: !flag.enabled,
              updatedAt: new Date().toISOString().slice(0, 10),
            }
          : flag,
      ),
    );
    const flag = this.featureFlagsSignal().find((f) => f.id === id);
    if (flag) {
      this.pushAudit({
        actor: 'Oda Dink',
        action: flag.enabled ? 'Feature Flag Enabled' : 'Feature Flag Disabled',
        target: flag.key,
        category: 'Platform',
        result: 'success',
        description: `${flag.name} set to ${flag.enabled ? 'enabled' : 'disabled'}.`,
      });
      this.toast.success(
        `${flag.name} is now ${flag.enabled ? 'enabled' : 'disabled'}.`,
        'Feature flag updated',
      );
    }
  }

  updateFeatureFlagRollout(id: string, rolloutPercent: number, options?: { notify?: boolean }): void {
    const clamped = Math.max(0, Math.min(100, rolloutPercent));
    const previous = this.featureFlagsSignal().find((f) => f.id === id)?.rolloutPercent;
    if (previous === clamped) return;

    this.featureFlagsSignal.update((list) =>
      list.map((flag) =>
        flag.id === id
          ? {
              ...flag,
              rolloutPercent: clamped,
              updatedAt: new Date().toISOString().slice(0, 10),
            }
          : flag,
      ),
    );

    if (!options?.notify) return;

    const flag = this.featureFlagsSignal().find((f) => f.id === id);
    if (flag) {
      this.pushAudit({
        actor: 'Oda Dink',
        action: 'Feature Flag Rollout Updated',
        target: flag.key,
        category: 'Platform',
        result: 'success',
        description: `${flag.name} rollout set to ${flag.rolloutPercent}%.`,
      });
      this.toast.success(`${flag.name} rollout set to ${flag.rolloutPercent}%.`, 'Rollout updated');
    }
  }

  updatePlatformSettings(patch: Partial<PlatformSettings>): void {
    this.platformSettingsSignal.update((current) => ({ ...current, ...patch }));
    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Platform Settings Updated',
      target: 'Workforce HQ',
      category: 'Platform',
      result: 'success',
      description: `Updated settings: ${Object.keys(patch).join(', ')}`,
    });
    this.toast.success('Your platform settings have been saved.', 'Settings saved');
  }

  createOrganization(payload: {
    name: string;
    slug?: string;
    industry: string;
    country: string;
    planId: string;
    status?: OrgStatus;
    interval?: PlanInterval;
    seats?: number;
    locationCount?: number;
    usageLimits?: {
      usersLimit: number;
      locationsLimit: number;
      managersLimit: number;
      storageLimitGb: number;
    };
    primaryAdmin: {
      name: string;
      email: string;
      role: string;
    };
    notes?: string;
  }): string {
    const plan = this.getPlan(payload.planId);
    if (!plan) {
      this.toast.error('The selected plan could not be found.', 'Create failed');
      return '';
    }

    const id = `org-${Date.now()}`;
    const slug =
      payload.slug?.trim() ||
      payload.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    const adminId = `adm-${Date.now()}`;
    const status = payload.status ?? 'trial';
    const subscriptionStatus: SubscriptionStatus =
      status === 'past_due'
        ? 'past_due'
        : status === 'suspended'
          ? 'suspended'
          : status === 'cancelled' || status === 'archived'
            ? 'cancelled'
            : status === 'active'
              ? 'active'
              : 'trial';
    const interval = payload.interval ?? plan.interval;
    const seats = payload.seats ?? plan.seatsIncluded;
    const locationsLimit = payload.usageLimits?.locationsLimit ?? plan.locationsIncluded;
    const usersLimit = payload.usageLimits?.usersLimit ?? seats;
    const managersLimit =
      payload.usageLimits?.managersLimit ?? Math.max(5, Math.floor(usersLimit / 10));
    const storageLimitGb =
      payload.usageLimits?.storageLimitGb ??
      (plan.id === 'plan-enterprise' ? 200 : plan.id === 'plan-growth' ? 100 : 50);
    const locationCount = Math.min(payload.locationCount ?? 1, locationsLimit);
    const mrr = status === 'trial' ? 0 : plan.priceMonthly;
    const now = new Date().toISOString();

    const org: Organization = {
      id,
      name: payload.name.trim(),
      slug,
      status,
      planId: payload.planId,
      subscriptionStatus,
      industry: payload.industry.trim(),
      country: payload.country.trim(),
      primaryAdminId: adminId,
      userCount: 0,
      employeeCount: 0,
      locationCount,
      mrr,
      createdAt: now.slice(0, 10),
      lastActivityAt: now,
      usage: {
        users: 0,
        usersLimit,
        locations: locationCount,
        locationsLimit,
        managers: 0,
        managersLimit,
        storageGb: 0,
        storageLimitGb,
      },
    };

    const admin: AdminUser = {
      id: adminId,
      name: payload.primaryAdmin.name.trim(),
      email: payload.primaryAdmin.email.trim(),
      organizationId: id,
      role: payload.primaryAdmin.role.trim() || 'Customer Admin',
      status: 'invited',
      lastActiveAt: now,
      avatarColor: '#4b22b3',
    };

    const renewalDays = interval === 'yearly' ? 365 : 30;
    const subscription: Subscription = {
      id: `sub-${Date.now()}`,
      organizationId: id,
      planId: payload.planId,
      status: subscriptionStatus,
      interval,
      seats,
      amount: mrr,
      startDate: now.slice(0, 10),
      renewalDate: new Date(Date.now() + renewalDays * 86_400_000).toISOString().slice(0, 10),
      paymentStatus:
        subscriptionStatus === 'past_due'
          ? 'failed'
          : subscriptionStatus === 'trial'
            ? 'n/a'
            : subscriptionStatus === 'active'
              ? 'paid'
              : 'pending',
    };

    this.organizationsSignal.update((list) => [org, ...list]);
    this.adminsSignal.update((list) => [admin, ...list]);
    this.subscriptionsSignal.update((list) => [subscription, ...list]);
    this.plansSignal.update((list) =>
      list.map((p) => (p.id === payload.planId ? { ...p, subscribers: p.subscribers + 1 } : p)),
    );

    const noteSuffix = payload.notes?.trim() ? ` Notes: ${payload.notes.trim()}` : '';
    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Organization Created',
      target: org.name,
      category: 'Organizations',
      result: 'success',
      description: `${org.name} created on ${plan.name} (${status}). Primary admin ${admin.email}.${noteSuffix}`,
    });

    this.toast.success(
      `${org.name} is ready on the ${plan.name} plan.`,
      'Organization created',
    );

    return id;
  }

  createPlan(payload: {
    name: string;
    priceMonthly: number;
    seatsIncluded: number;
    locationsIncluded: number;
    interval?: PlanInterval;
    status?: Plan['status'];
    featureIds?: string[];
    notes?: string;
  }): string {
    const id = `plan-${Date.now()}`;
    const now = new Date().toISOString().slice(0, 10);
    const featureIds =
      payload.featureIds?.length ?
        payload.featureIds
      : this.features.filter((f) => !f.optional).map((f) => f.id);
    const plan: Plan = {
      id,
      name: payload.name.trim(),
      status: payload.status ?? 'draft',
      interval: payload.interval ?? 'monthly',
      priceMonthly: payload.priceMonthly,
      seatsIncluded: payload.seatsIncluded,
      locationsIncluded: payload.locationsIncluded,
      featureIds,
      subscribers: 0,
      updatedAt: now,
    };

    this.plansSignal.update((list) => [plan, ...list]);
    const noteSuffix = payload.notes?.trim() ? ` Notes: ${payload.notes.trim()}` : '';
    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Plan Created',
      target: plan.name,
      category: 'Platform',
      result: 'success',
      description: `${plan.name} plan created (${plan.status}, ${formatHqCurrency(plan.priceMonthly)}/mo, ${featureIds.length} features).${noteSuffix}`,
    });

    this.toast.success(
      `${plan.name} added to the catalogue (${formatHqCurrency(plan.priceMonthly)}/mo).`,
      'Plan created',
    );

    return id;
  }

  retrySubscriptionPayment(subscriptionId: string): void {
    const sub = this.getSubscription(subscriptionId);
    if (!sub || sub.status !== 'past_due') return;

    this.subscriptionsSignal.update((list) =>
      list.map((item) =>
        item.id === subscriptionId
          ? { ...item, status: 'active', paymentStatus: 'paid' }
          : item,
      ),
    );

    this.organizationsSignal.update((list) =>
      list.map((org) =>
        org.id === sub.organizationId
          ? {
              ...org,
              status: 'active',
              subscriptionStatus: 'active',
              lastActivityAt: new Date().toISOString(),
            }
          : org,
      ),
    );

    const org = this.getOrganization(sub.organizationId);
    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Payment Retried',
      target: org?.name ?? subscriptionId,
      category: 'Billing',
      result: 'success',
      description: 'Failed payment successfully retried.',
    });
    this.toast.success(
      `Payment recovered for ${org?.name ?? 'subscription'}.`,
      'Payment retried',
    );
  }

  cancelSubscription(subscriptionId: string): void {
    const sub = this.getSubscription(subscriptionId);
    if (!sub) return;

    this.subscriptionsSignal.update((list) =>
      list.map((item) =>
        item.id === subscriptionId
          ? { ...item, status: 'cancelled', paymentStatus: 'pending' }
          : item,
      ),
    );

    this.organizationsSignal.update((list) =>
      list.map((org) =>
        org.id === sub.organizationId
          ? {
              ...org,
              status: 'cancelled',
              subscriptionStatus: 'cancelled',
              mrr: 0,
              lastActivityAt: new Date().toISOString(),
            }
          : org,
      ),
    );

    const org = this.getOrganization(sub.organizationId);
    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Subscription Cancelled',
      target: org?.name ?? subscriptionId,
      category: 'Subscriptions',
      result: 'warning',
      description: 'Subscription cancelled from HQ.',
    });
    this.toast.warning(
      `${org?.name ?? 'Subscription'} has been cancelled.`,
      'Subscription cancelled',
    );
  }

  schedulePlanChange(subscriptionId: string, newPlanId: string, note: string): void {
    const sub = this.getSubscription(subscriptionId);
    const newPlan = this.getPlan(newPlanId);
    if (!sub || !newPlan) return;

    const effectiveDate = sub.billingPeriodEnd ?? sub.renewalDate;
    this.subscriptionsSignal.update((list) =>
      list.map((item) =>
        item.id === subscriptionId
          ? {
              ...item,
              pendingPlanChange: {
                toPlanId: newPlanId,
                effectiveDate,
                scheduledAt: new Date().toISOString(),
                note,
              },
            }
          : item,
      ),
    );

    const org = this.getOrganization(sub.organizationId);
    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Plan Change Scheduled',
      target: org?.name ?? subscriptionId,
      category: 'Subscriptions',
      result: 'success',
      description: `Downgrade to ${newPlan.name} scheduled for ${effectiveDate}. ${note}`,
    });
    this.toast.info(
      `Plan change to ${newPlan.name} scheduled for ${effectiveDate}.`,
      'Change scheduled',
    );
  }

  cancelPendingPlanChange(subscriptionId: string): void {
    const sub = this.getSubscription(subscriptionId);
    if (!sub?.pendingPlanChange) return;

    this.subscriptionsSignal.update((list) =>
      list.map((item) =>
        item.id === subscriptionId ? { ...item, pendingPlanChange: undefined } : item,
      ),
    );

    const org = this.getOrganization(sub.organizationId);
    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Scheduled Plan Change Cancelled',
      target: org?.name ?? subscriptionId,
      category: 'Subscriptions',
      result: 'success',
      description: 'Pending plan change removed.',
    });
    this.toast.success('Scheduled plan change cancelled.', 'Change cancelled');
  }

  getPlanChangesForPlan(planId: string): PlanChangeRecord[] {
    return this.planChangesSignal().filter(
      (c) => c.fromPlanId === planId || c.toPlanId === planId,
    );
  }

  updatePlan(planId: string, patch: Partial<Pick<Plan, 'name' | 'priceMonthly' | 'seatsIncluded' | 'locationsIncluded' | 'status' | 'featureIds'>>): void {
    this.plansSignal.update((list) =>
      list.map((p) =>
        p.id === planId
          ? { ...p, ...patch, updatedAt: new Date().toISOString().slice(0, 10) }
          : p,
      ),
    );
    const plan = this.getPlan(planId);
    if (plan) {
      this.pushAudit({
        actor: 'Oda Dink',
        action: 'Plan Updated',
        target: plan.name,
        category: 'Platform',
        result: 'success',
        description: `Plan ${plan.name} updated.`,
      });
      this.toast.success(`${plan.name} has been updated.`, 'Plan saved');
    }
  }

  retirePlan(planId: string): void {
    this.updatePlan(planId, { status: 'retired' });
  }

  connectIntegration(integrationId: string): void {
    this.integrationsSignal.update((list) =>
      list.map((item) =>
        item.id === integrationId && item.status === 'available'
          ? { ...item, status: 'connected' as const }
          : item,
      ),
    );
    const integration = this.integrationsSignal().find((i) => i.id === integrationId);
    if (integration) {
      this.pushAudit({
        actor: 'Oda Dink',
        action: 'Integration Connected',
        target: integration.name,
        category: 'Platform',
        result: 'success',
        description: `${integration.name} connected (mock).`,
      });
      this.toast.success(`${integration.name} is now connected.`, 'Integration connected');
    }
  }

  toggleNotificationTemplate(id: string): void {
    this.notificationTemplatesSignal.update((list) =>
      list.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)),
    );
  }

  getOrgUsageDetail(orgId: string): {
    featureUsage: Array<{ featureId: string; name: string; activeUsers: number; limit: number }>;
    apiCalls: number;
    apiLimit: number;
  } {
    const org = this.getOrganization(orgId);
    const plan = org ? this.getPlan(org.planId) : undefined;
    const features = plan
      ? this.features.filter((f) => plan.featureIds.includes(f.id)).slice(0, 6)
      : [];
    return {
      featureUsage: features.map((f, i) => ({
        featureId: f.id,
        name: f.name,
        activeUsers: Math.floor((org?.userCount ?? 0) * (0.4 + i * 0.08)),
        limit: org?.usage.usersLimit ?? 100,
      })),
      apiCalls: Math.floor((org?.userCount ?? 0) * 12.5),
      apiLimit: 50000,
    };
  }

  getUsersForOrg(orgId: string): GlobalUser[] {
    return this.globalUsersSignal().filter((u) => u.organizationId === orgId);
  }

  getInvoiceDetail(invoiceId: string): InvoiceDetailView | null {
    const invoice = this.invoicesSignal().find((i) => i.id === invoiceId);
    if (!invoice) return null;

    const organization = this.getOrganization(invoice.organizationId);
    if (!organization) return null;

    const subscription = this.getSubscription(invoice.subscriptionId);
    const plan = subscription ? this.getPlan(subscription.planId) : this.getPlan(organization.planId);
    const lineItems = buildInvoiceLineItems(subscription, plan, invoice.amount);
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = computeInvoiceTax(subtotal);
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    return {
      invoice,
      organization,
      subscription,
      plan,
      lineItems,
      subtotal,
      taxAmount,
      total,
      currency: HQ_CURRENCY,
      payments: this.getPaymentsForInvoice(invoiceId),
    };
  }

  getPaymentDetail(paymentId: string): PaymentDetailView | null {
    const payment = this.paymentsSignal().find((p) => p.id === paymentId);
    if (!payment) return null;

    const organization = this.getOrganization(payment.organizationId);
    if (!organization) return null;

    const invoice = this.invoicesSignal().find((i) => i.id === payment.invoiceId);
    const subscription = invoice
      ? this.getSubscription(invoice.subscriptionId)
      : this.getSubscriptionForOrg(payment.organizationId);
    const plan = subscription ? this.getPlan(subscription.planId) : this.getPlan(organization.planId);

    return { payment, organization, invoice, subscription, plan };
  }

  downloadInvoice(invoiceId: string): void {
    const detail = this.getInvoiceDetail(invoiceId);
    if (!detail) {
      this.toast.error('Invoice not found.', 'Download failed');
      return;
    }

    void this.exportInvoicePdf(detail);
  }

  private async exportInvoicePdf(detail: InvoiceDetailView): Promise<void> {
    try {
      const blob = await buildInvoicePdf(detail);
      this.triggerBlobDownload(`${detail.invoice.number}.pdf`, blob);
      this.pushAudit({
        actor: 'Oda Dink',
        action: 'Invoice Downloaded',
        target: detail.invoice.number,
        category: 'Billing',
        result: 'success',
        description: `Invoice ${detail.invoice.number} exported as PDF for ${detail.organization.name}.`,
        detailNotes:
          `PDF export was generated from the HQ Billing console for ${detail.organization.name}. The file includes bill-to details, subscription context, line items, GST breakdown, and payment history as of export time.\n\n` +
          `Export was initiated manually by Oda Dink. In production this action may be subject to permission checks and data-retention policies. The downloaded artifact is intended for customer finance teams and should match the portal invoice view.\n\n` +
          'No changes were made to invoice status or ledger balances as part of this read-only export.',
        relatedRefs: [
          { label: 'Invoice', value: detail.invoice.number },
          { label: 'Organization', value: detail.organization.name },
          { label: 'Total', value: formatHqCurrency(detail.total, true) },
          { label: 'Format', value: 'PDF · Letter' },
        ],
      });
      this.toast.success(`${detail.invoice.number}.pdf downloaded.`, 'Invoice PDF ready');
    } catch {
      this.toast.error('Could not generate the PDF export.', 'Download failed');
    }
  }

  downloadInvoicesBulk(invoiceIds: string[]): void {
    if (!invoiceIds.length) return;
    invoiceIds.forEach((id) => this.downloadInvoice(id));
    this.toast.info(`${invoiceIds.length} invoice(s) exported.`, 'Bulk download');
  }

  updatePaymentGateway(patch: Partial<PaymentGatewayConfig>): void {
    this.paymentGatewaySignal.update((current) => ({ ...current, ...patch }));
    this.toast.success('Payment gateway settings saved.', 'Gateway updated');
  }

  connectPaymentGateway(): void {
    this.paymentGatewaySignal.update((g) => ({ ...g, connected: true, lastSyncedAt: new Date().toISOString() }));
    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Gateway Connected',
      target: 'Stripe',
      category: 'Billing',
      result: 'success',
      description: 'Stripe payment gateway connected (mock).',
    });
    this.toast.success('Stripe connected in test mode.', 'Gateway connected');
  }

  disconnectPaymentGateway(): void {
    this.paymentGatewaySignal.update((g) => ({ ...g, connected: false }));
    this.pushAudit({
      actor: 'Oda Dink',
      action: 'Gateway Disconnected',
      target: 'Stripe',
      category: 'Billing',
      result: 'warning',
      description: 'Stripe payment gateway disconnected (mock).',
    });
    this.toast.warning('Payment processing paused until reconnected.', 'Gateway disconnected');
  }

  testPaymentGatewayConnection(): void {
    const gateway = this.paymentGatewaySignal();
    if (!gateway.connected) {
      this.toast.error('Connect a gateway before testing.', 'Test failed');
      return;
    }
    this.paymentGatewaySignal.update((g) => ({ ...g, lastSyncedAt: new Date().toISOString() }));
    this.toast.success(`Stripe ${gateway.mode} mode connection verified.`, 'Connection OK');
  }

  private triggerFileDownload(filename: string, content: string, mime: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const blob = new Blob([content], { type: mime });
    this.triggerBlobDownload(filename, blob);
  }

  private triggerBlobDownload(filename: string, blob: Blob): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private bootstrapHqRoles(): HqRoleDefinition[] {
    if (!this.isBrowser) {
      return HQ_ROLES.map((role) => ({ ...role, permissions: { ...role.permissions } }));
    }
    return loadHqRolesFromStorage((key) => localStorage.getItem(key));
  }

  private persistHqRoles(): void {
    if (!this.isBrowser) return;
    localStorage.setItem(HQ_ROLES_STORAGE_KEY, JSON.stringify(this.hqRolesSignal()));
  }
}
