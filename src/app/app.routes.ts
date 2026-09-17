import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { AuthLayout } from './features/auth/auth-layout/auth-layout';
import { ForgotPasswordPage } from './features/auth/forgot-password-page/forgot-password-page';
import { LoginPage } from './features/auth/login-page/login-page';
import { RegisterPage } from './features/auth/register-page/register-page';
import { HqShell } from './layout/hq-shell/hq-shell';
import { DashboardPage } from './features/dashboard/dashboard-page';
import { OrganizationsPage } from './features/organizations/organizations-page';
import { OrganizationCreatePage } from './features/organizations/organization-create-page';
import { OrganizationDetailPage } from './features/organizations/organization-detail-page';
import { SubscriptionsPage } from './features/subscriptions/subscriptions-page';
import { SubscriptionDetailPage } from './features/subscriptions/subscription-detail-page';
import { PlansPage } from './features/plans/plans-page';
import { PlanCreatePage } from './features/plans/plan-create-page';
import { PlanDetailPage } from './features/plans/plan-detail-page';
import { PlanEditPage } from './features/plans/plan-edit-page';
import { UsersPage } from './features/users/users-page';
import { PermissionsPage } from './features/permissions/permissions-page';
import { RoleDetailPage } from './features/permissions/role-detail-page';
import { BillingPage } from './features/billing/billing-page';
import { UsagePage } from './features/usage/usage-page';
import { OrganizationUsagePage } from './features/usage/organization-usage-page';
import { EntitlementsPage } from './features/entitlements/entitlements-page';
import { SecurityPage } from './features/security/security-page';
import { SupportPage } from './features/support/support-page';
import { NotificationsPage } from './features/notifications/notifications-page';
import { PlatformPage } from './features/platform/platform-page';
import { AccessDeniedPage } from './features/access-denied/access-denied-page';

export const routes: Routes = [
  {
    path: 'auth',
    component: AuthLayout,
    canActivate: [guestGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      { path: 'login', component: LoginPage },
      { path: 'register', component: RegisterPage },
      { path: 'forgot-password', component: ForgotPasswordPage },
    ],
  },
  {
    path: '',
    component: HqShell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPage },
      {
        path: 'access-denied',
        component: AccessDeniedPage,
      },
      {
        path: 'organizations',
        component: OrganizationsPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'organizations', min: 'read' } },
      },
      {
        path: 'organizations/new',
        component: OrganizationCreatePage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'organizations', min: 'write' } },
      },
      {
        path: 'organizations/:id',
        component: OrganizationDetailPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'organizations', min: 'read' } },
      },
      {
        path: 'users',
        component: UsersPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'users', min: 'read' } },
      },
      {
        path: 'permissions',
        component: PermissionsPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'permissions', min: 'read' } },
      },
      {
        path: 'permissions/:id',
        component: RoleDetailPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'permissions', min: 'read' } },
      },
      {
        path: 'subscriptions',
        component: SubscriptionsPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'subscriptions', min: 'read' } },
      },
      {
        path: 'subscriptions/:id',
        component: SubscriptionDetailPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'subscriptions', min: 'read' } },
      },
      {
        path: 'billing',
        component: BillingPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'billing', min: 'read' } },
      },
      {
        path: 'plans',
        component: PlansPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'plans', min: 'read' } },
      },
      {
        path: 'plans/new',
        component: PlanCreatePage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'plans', min: 'write' } },
      },
      {
        path: 'plans/:id/edit',
        component: PlanEditPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'plans', min: 'write' } },
      },
      {
        path: 'plans/:id',
        component: PlanDetailPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'plans', min: 'read' } },
      },
      {
        path: 'entitlements',
        component: EntitlementsPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'features', min: 'read' } },
      },
      {
        path: 'usage',
        component: UsagePage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'usage', min: 'read' } },
      },
      {
        path: 'usage/:orgId',
        component: OrganizationUsagePage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'usage', min: 'read' } },
      },
      {
        path: 'support',
        component: SupportPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'support', min: 'read' } },
      },
      {
        path: 'security',
        component: SecurityPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'security', min: 'read' } },
      },
      {
        path: 'notifications',
        component: NotificationsPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'settings', min: 'read' } },
      },
      {
        path: 'platform',
        component: PlatformPage,
        canActivate: [permissionGuard],
        data: { permission: { category: 'settings', min: 'read' } },
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
