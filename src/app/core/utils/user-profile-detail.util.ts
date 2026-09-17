import {
  AdminUser,
  AuditEvent,
  GlobalUser,
  Organization,
  Plan,
  SignInActivity,
  Subscription,
} from '../models/hq.models';
import { formatHqCurrency } from '../constants/currency.constants';

export interface UserProfileDetail {
  summary: string;
  profileParagraphs: string[];
  accountRefs: { label: string; value: string }[];
  organizationRefs: { label: string; value: string }[];
  accessItems: string[];
  signIns: SignInActivity[];
  auditEvents: AuditEvent[];
}

function hashSeed(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function defaultPhone(email: string): string {
  const seeds = ['+91 98', '+91 97', '+44 161', '+1 415', '+971 4'];
  return `${seeds[hashSeed(email) % seeds.length]} ${String(1000000 + (hashSeed(email) % 9000000)).slice(0, 7)}`;
}

function defaultTimezone(country: string): string {
  const map: Record<string, string> = {
    India: 'Asia/Kolkata (IST)',
    'United Kingdom': 'Europe/London (GMT+1)',
    Ireland: 'Europe/Dublin (GMT+1)',
    'United States': 'America/New_York (EDT)',
    Canada: 'America/Toronto (EDT)',
    Germany: 'Europe/Berlin (CEST)',
    Australia: 'Australia/Sydney (AEST)',
    'New Zealand': 'Pacific/Auckland (NZST)',
    'United Arab Emirates': 'Asia/Dubai (GST)',
    Netherlands: 'Europe/Amsterdam (CEST)',
  };
  return map[country] ?? 'UTC';
}

function joinedDate(lastActive: string, status: string): string {
  const d = new Date(lastActive);
  const monthsAgo = status === 'invited' ? 0 : 3 + (hashSeed(lastActive) % 18);
  d.setMonth(d.getMonth() - monthsAgo);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function invitedDate(lastActive: string): string {
  const d = new Date(lastActive);
  d.setDate(d.getDate() - 7);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function accessForRole(role: string): string[] {
  if (role === 'Customer Admin' || role === 'Admin') {
    return [
      'Manage organization settings and billing contacts',
      'Invite and deactivate customer administrators',
      'Configure workforce modules enabled on the plan',
      'View usage, reports, and audit history for the tenant',
    ];
  }
  if (role === 'Ops Admin') {
    return [
      'Manage rota, shifts, and location configuration',
      'Approve leave and attendance exceptions',
      'Cannot change subscription or billing settings',
    ];
  }
  if (role === 'Billing Admin') {
    return [
      'View and download invoices and payment receipts',
      'Update payment methods and billing contacts',
      'Cannot modify workforce scheduling data',
    ];
  }
  if (role === 'Manager') {
    return [
      'Manage team schedules and approve timesheets',
      'View reports for assigned locations only',
      'Cannot access organization billing or admin settings',
    ];
  }
  return [
    'View assigned shifts and submit timesheets',
    'Request leave and swap shifts within team policy',
    'No access to admin or billing screens',
  ];
}

function buildOrgRefs(
  org: Organization | undefined,
  plan: Plan | undefined,
  subscription: Subscription | undefined,
): { label: string; value: string }[] {
  if (!org) return [{ label: 'Organization', value: '—' }];
  return [
    { label: 'Organization', value: org.name },
    { label: 'Industry', value: org.industry },
    { label: 'Country', value: org.country },
    { label: 'Org status', value: org.status.replace('_', ' ') },
    { label: 'Plan', value: plan?.name ?? '—' },
    { label: 'Subscription', value: subscription?.status.replace('_', ' ') ?? org.subscriptionStatus.replace('_', ' ') },
    { label: 'MRR', value: org.mrr > 0 ? formatHqCurrency(org.mrr) : 'Trial / inactive' },
    { label: 'Users', value: `${org.userCount} / ${org.usage.usersLimit}` },
    { label: 'Locations', value: `${org.locationCount} / ${org.usage.locationsLimit}` },
  ];
}

export function buildAdminProfileDetail(
  admin: AdminUser,
  org: Organization | undefined,
  plan: Plan | undefined,
  subscription: Subscription | undefined,
  signIns: SignInActivity[],
  auditEvents: AuditEvent[],
): UserProfileDetail {
  const mfaEnabled = admin.status === 'active' && hashSeed(admin.id) % 5 !== 0;
  const phone = admin.phone ?? defaultPhone(admin.email);
  const timezone = admin.timezone ?? defaultTimezone(org?.country ?? 'India');
  const locale = admin.locale ?? (org?.country === 'India' ? 'en-IN' : 'en-GB');
  const joined = admin.joinedAt ?? joinedDate(admin.lastActiveAt, admin.status);
  const invited = admin.invitedAt ?? invitedDate(admin.lastActiveAt);

  const summary =
    admin.status === 'invited'
      ? `Invitation pending for ${admin.role} access at ${org?.name ?? 'the organization'}.`
      : admin.status === 'deactivated'
        ? `Account deactivated — login and API access revoked for ${org?.name ?? 'the organization'}.`
        : `Primary ${admin.role} for ${org?.name ?? 'the organization'} with full tenant administration access.`;

  const profileParagraphs = admin.detailNotes
    ? admin.detailNotes.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    : [
        `${admin.name} (${admin.email}) is registered as a ${admin.role} on the ${org?.name ?? 'customer'} tenant. ${
          admin.status === 'active'
            ? 'The account is in good standing with MFA ' + (mfaEnabled ? 'enabled' : 'not yet configured') + '.'
            : admin.status === 'invited'
              ? 'An invitation email was sent and the account has not completed first sign-in.'
              : 'The account was deactivated by an HQ operator and cannot sign in until reactivated.'
        }`,
        org
          ? `${org.name} is on the ${plan?.name ?? 'assigned'} plan (${org.subscriptionStatus.replace('_', ' ')}). The organization operates in ${org.industry} with ${org.locationCount} location(s) and ${org.userCount} active users on the platform.`
          : 'Organization context is unavailable for this profile.',
        'In production, this drawer would also surface IdP group mappings, SCIM provisioning status, support sessions opened on behalf of this user, and password reset history.',
      ];

  const accountRefs: { label: string; value: string }[] = [
    { label: 'User ID', value: admin.id },
    { label: 'Email', value: admin.email },
    { label: 'Phone', value: phone },
    { label: 'Role', value: admin.role },
    { label: 'Status', value: admin.status },
    { label: 'MFA', value: mfaEnabled ? 'Enabled' : 'Not configured' },
    { label: 'Locale', value: locale },
    { label: 'Timezone', value: timezone },
    { label: admin.status === 'invited' ? 'Invited on' : 'Joined on', value: admin.status === 'invited' ? invited : joined },
    { label: 'Last active', value: new Date(admin.lastActiveAt).toLocaleString('en-IN') },
  ];

  if (admin.department) {
    accountRefs.splice(4, 0, { label: 'Department', value: admin.department });
  }

  return {
    summary,
    profileParagraphs,
    accountRefs,
    organizationRefs: buildOrgRefs(org, plan, subscription),
    accessItems: accessForRole(admin.role),
    signIns,
    auditEvents,
  };
}

export function buildGlobalUserProfileDetail(
  user: GlobalUser,
  org: Organization | undefined,
  plan: Plan | undefined,
  subscription: Subscription | undefined,
  signIns: SignInActivity[],
  auditEvents: AuditEvent[],
): UserProfileDetail {
  const mfaEnabled = user.status === 'active' && hashSeed(user.id) % 3 !== 0;
  const phone = defaultPhone(user.email);
  const timezone = defaultTimezone(org?.country ?? 'India');
  const joined = joinedDate(user.lastActiveAt, user.status);

  const summary =
    user.status === 'invited'
      ? `${user.role} invitation pending at ${org?.name ?? 'the organization'}.`
      : `${user.role} on ${org?.name ?? 'the organization'} — ${user.status} workforce user.`;

  const profileParagraphs = [
    `${user.name} works as a ${user.role} under ${org?.name ?? 'their organization'}. Account email ${user.email} is used for portal sign-in and notification delivery.`,
    org
      ? `The user belongs to a ${org.industry} tenant on the ${plan?.name ?? 'current'} plan. Location and module access follow ${user.role.toLowerCase()} permissions configured by the customer admin team.`
      : 'Organization linkage could not be resolved for this directory entry.',
    user.status === 'deactivated'
      ? 'This profile was deactivated and cannot access mobile or web apps. Historical timesheet and attendance records remain retained per tenant policy.'
      : 'Session history and audit entries below reflect the most recent sign-in and platform actions associated with this identity.',
  ];

  const accountRefs: { label: string; value: string }[] = [
    { label: 'User ID', value: user.id },
    { label: 'Email', value: user.email },
    { label: 'Phone', value: phone },
    { label: 'Role', value: user.role },
    { label: 'Status', value: user.status },
    { label: 'MFA', value: mfaEnabled ? 'Enabled' : 'Optional' },
    { label: 'Timezone', value: timezone },
    { label: 'Joined on', value: joined },
    { label: 'Last active', value: new Date(user.lastActiveAt).toLocaleString('en-IN') },
  ];

  return {
    summary,
    profileParagraphs,
    accountRefs,
    organizationRefs: buildOrgRefs(org, plan, subscription),
    accessItems: accessForRole(user.role),
    signIns,
    auditEvents,
  };
}
