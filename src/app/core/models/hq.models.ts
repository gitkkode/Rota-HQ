export type OrgStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled'
  | 'archived';

export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancelled';

export type PlanInterval = 'monthly' | 'yearly';

export type HqRole =
  | 'Super Admin'
  | 'Platform Admin'
  | 'Billing Admin'
  | 'Support Admin'
  | 'Security Admin'
  | 'HQ Viewer';

export interface Plan {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'retired';
  interval: PlanInterval;
  priceMonthly: number;
  seatsIncluded: number;
  locationsIncluded: number;
  featureIds: string[];
  addOnFeatureIds?: string[];
  subscribers: number;
  updatedAt: string;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  category:
    | 'Workforce'
    | 'Analytics'
    | 'Documents'
    | 'Communication'
    | 'Integrations'
    | 'Enterprise';
  status: 'available' | 'beta' | 'deprecated';
  optional: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  planId: string;
  subscriptionStatus: SubscriptionStatus;
  industry: string;
  country: string;
  primaryAdminId: string;
  userCount: number;
  employeeCount: number;
  locationCount: number;
  mrr: number;
  createdAt: string;
  lastActivityAt: string;
  usage: {
    users: number;
    usersLimit: number;
    locations: number;
    locationsLimit: number;
    managers: number;
    managersLimit: number;
    storageGb: number;
    storageLimitGb: number;
  };
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  role: string;
  status: 'active' | 'invited' | 'deactivated';
  lastActiveAt: string;
  avatarColor: string;
  phone?: string;
  timezone?: string;
  locale?: string;
  department?: string;
  invitedAt?: string;
  joinedAt?: string;
  detailNotes?: string;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  interval: PlanInterval;
  seats: number;
  amount: number;
  startDate: string;
  renewalDate: string;
  paymentStatus: 'paid' | 'failed' | 'pending' | 'n/a';
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  pendingPlanChange?: {
    toPlanId: string;
    effectiveDate: string;
    scheduledAt: string;
    note: string;
  };
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  category: string;
  result: 'success' | 'failed' | 'warning';
  description: string;
  /** Multi-paragraph narrative shown in the activity detail drawer. */
  detailNotes?: string;
  /** Optional reference fields (invoice ID, payment ID, etc.). */
  relatedRefs?: { label: string; value: string }[];
  organizationId?: string;
  supportSessionId?: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  timeAgo: string;
  tone: 'purple' | 'blue' | 'green' | 'orange';
  link: string;
}

export interface PlatformAlert {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  organizationName?: string;
  actionLabel: string;
  actionLink: string;
  actionQueryParams?: Record<string, string>;
}

export interface TrendPoint {
  label: string;
  signups: number;
  renewals: number;
}

export interface GlobalUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  role: 'Admin' | 'Manager' | 'Employee';
  status: 'active' | 'invited' | 'deactivated';
  lastActiveAt: string;
}

export interface ActiveSession {
  id: string;
  userName: string;
  email: string;
  role: string;
  organizationName: string | null;
  location: string;
  device: string;
  ip: string;
  startedAt: string;
  lastSeenAt: string;
  risk: 'low' | 'medium' | 'high';
}

export interface PlanChangeRecord {
  id: string;
  subscriptionId: string;
  fromPlanId: string;
  toPlanId: string;
  changedAt: string;
  changedBy: string;
  note: string;
}

export interface SupportSession {
  id: string;
  organizationId: string;
  targetUserName: string;
  targetUserEmail: string;
  operatorName: string;
  reason: string;
  status: 'active' | 'ended';
  startedAt: string;
  endsAt: string;
  endedAt?: string;
}

export interface HqNotification {
  id: string;
  title: string;
  body: string;
  category:
    | 'organization'
    | 'billing'
    | 'usage'
    | 'security'
    | 'integration'
    | 'platform';
  kind:
    | 'payment_failure'
    | 'trial_expiring'
    | 'trial_ended'
    | 'usage_limit'
    | 'org_created'
    | 'security'
    | 'integration'
    | 'platform'
    | 'subscription_ended';
  organizationId?: string;
  read: boolean;
  createdAt: string;
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercent: number;
  environment: 'all' | 'production' | 'staging';
  updatedAt: string;
}

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  defaultTimezone: string;
  defaultLocale: string;
  defaultTrialDays: number;
  maintenanceMode: boolean;
  sessionTimeoutMinutes: number;
  requireMfaForHq: boolean;
  notifyOnPaymentFailure: boolean;
  notifyOnTrialExpiry: boolean;
}

export type PermissionLevel = 'none' | 'read' | 'write' | 'full';

export type PermissionCategoryKey =
  | 'organizations'
  | 'users'
  | 'subscriptions'
  | 'plans'
  | 'features'
  | 'permissions'
  | 'billing'
  | 'usage'
  | 'support'
  | 'security'
  | 'settings'
  | 'audit';

export interface PermissionCategory {
  key: PermissionCategoryKey;
  label: string;
  description: string;
}

export interface HqRoleDefinition {
  id: string;
  name: HqRole;
  description: string;
  operatorCount: number;
  permissions: Record<PermissionCategoryKey, PermissionLevel>;
  updatedAt: string;
}

export interface OrgFeatureOverride {
  organizationId: string;
  featureId: string;
  enabled: boolean;
  reason: string;
  updatedAt: string;
  updatedBy: string;
}

export type InvoiceStatus = 'paid' | 'open' | 'past_due' | 'void' | 'draft';

export interface Invoice {
  id: string;
  organizationId: string;
  subscriptionId: string;
  number: string;
  amount: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paidAt?: string;
}

export type PaymentStatus = 'succeeded' | 'failed' | 'pending' | 'refunded';

export interface Payment {
  id: string;
  organizationId: string;
  invoiceId: string;
  amount: number;
  status: PaymentStatus;
  method: string;
  processedAt: string;
  failureReason?: string;
  transactionId: string;
  gatewayReference: string;
  currency: string;
  feeAmount: number;
  netAmount: number;
  receiptNumber: string;
}

export interface IntegrationPlaceholder {
  id: string;
  name: string;
  category: string;
  description: string;
  status: 'connected' | 'available' | 'coming_soon';
  icon: string;
}

export interface BreadcrumbItem {
  label: string;
  link?: string;
}

export interface NotificationTemplate {
  id: string;
  key: string;
  name: string;
  subject: string;
  channel: 'email' | 'in_app' | 'both';
  category: HqNotification['category'];
  enabled: boolean;
  updatedAt: string;
}

export interface PaymentGatewayConfig {
  provider: 'stripe';
  connected: boolean;
  mode: 'test' | 'live';
  publishableKey: string;
  secretKeyMasked: string;
  webhookUrl: string;
  webhookSecretMasked: string;
  lastSyncedAt: string;
  currency: string;
}

export interface SignInActivity {
  id: string;
  userName: string;
  email: string;
  organizationName: string | null;
  location: string;
  device: string;
  ip: string;
  timestamp: string;
  result: 'success' | 'failed';
}

export interface SecurityAlertItem {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  timestamp: string;
}

export interface OrgUsageDetail {
  organizationId: string;
  featureUsage: Array<{ featureId: string; activeUsers: number; limit: number }>;
  apiCalls: number;
  apiLimit: number;
}

