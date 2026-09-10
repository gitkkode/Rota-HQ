# Workforce HQ — Required APIs

Frontend-only contract for the backend team. The Angular app currently uses in-memory mock data (`HqDataService` / `HqAuthService`). Nothing in this file is integrated yet.

**Keep this file in sync with the UI.** When a page, drawer, filter, or mutation is added or changed, add or update the matching APIs here in the same change.

---

## Conventions

| Item | Value |
| --- | --- |
| Base path | `/api/v1` |
| Format | JSON (`application/json`) unless noted |
| Auth | Session cookie **or** `Authorization: Bearer <token>` on every non-auth route |
| Actor | Taken from the authenticated HQ user. Do not hardcode names. |
| Currency | INR. Money fields are integers in **paise** (e.g. `12499` = ₹124.99) unless a field is documented as a decimal. |
| Dates | ISO-8601 (`2026-08-28T09:15:00Z`) or `YYYY-MM-DD` where the UI shows a date-only value |
| Pagination | `page` (1-based), `pageSize` (default `10`). List responses: `{ items, page, pageSize, total }` |
| Errors | `{ "error": { "code": "string", "message": "string", "fields": { } } }` |
| Permissions | Enforce the HQ role matrix. Levels: `none` \| `read` \| `write` \| `full`. Categories listed under [Permissions](#11-permissions--hq-roles). |
| Side effects | Mutations that change org, billing, support, security, or platform state **must** create an audit event. |

**Permission categories (route + action gates):**

`organizations` · `users` · `subscriptions` · `plans` · `features` · `permissions` · `billing` · `usage` · `support` · `security` · `settings` · `audit`

Write/full is required for create, update, invite, cancel, revoke, and similar actions. Read is enough for list/detail.

---

## 1. Auth

Pages: `/auth/login`, `/auth/register`, `/auth/forgot-password`. Logout from the shell profile menu.

### `POST /api/v1/auth/login` — Login

**Used by:** Login page  
**Body:** `{ email, password }`  
**200:** `{ token, user }` where `user` is `{ id, name, email, role, roleId }`  
**401:** invalid credentials (`Invalid email or password.`)

### `POST /api/v1/auth/register` — Register HQ operator

**Used by:** Register page  
**Body:** `{ name, email, password }`  
**201:** `{ token, user }` (session started)  
**400:** name required, invalid email, password &lt; 8 chars, email already exists  

> Confirm with product whether HQ self-registration is allowed in production. The mock assigns `Platform Admin`.

### `POST /api/v1/auth/forgot-password` — Request password reset

**Used by:** Forgot password page  
**Body:** `{ email }`  
**200:** always succeed with a generic message if you do not want to leak account existence. The mock currently returns an error when the email is unknown.  
**Follow-up (no UI yet):** `POST /api/v1/auth/reset-password` `{ token, password }`

### `POST /api/v1/auth/logout` — Logout

**Used by:** Shell profile menu  
**204:** session invalidated

### `GET /api/v1/auth/me` — Current session

**Used by:** Shell, auth guard, permission guard, nav  
**200:** `{ user: { id, name, email, role, roleId }, permissions: Record<PermissionCategoryKey, PermissionLevel>, role: HqRoleDefinition }`

---

## 2. Shell (global chrome)

Not a dedicated page. Always loaded for authenticated routes.

### `GET /api/v1/search` — Global search

**Used by:** Header search  
**Query:** `q`  
**200:** `{ organizations: Organization[], users: GlobalUser[], plans: Plan[] }` — first match of org → user → plan is used for navigation; otherwise the UI falls back to `/organizations?q=`

### `GET /api/v1/notifications/unread-count` — Unread badge

**Used by:** Shell bell  
**200:** `{ count }`  
Filtered by the signed-in role (Super Admin hides routine kinds: `org_created`, `subscription_ended`, `trial_ended`).

### `GET /api/v1/support/sessions/active` — Active support banner

**Used by:** Shell banner (“end session”)  
**200:** `SupportSession | null` (the current operator’s active impersonation, if any)

---

## 3. Dashboard

Page: `/dashboard`

Dashboard charts currently slice client-side. Prefer server-side aggregation keyed by date range.

### `GET /api/v1/dashboard` — Dashboard snapshot

**Used by:** Dashboard page (initial load)  
**Query:**

| Param | Notes |
| --- | --- |
| `from`, `to` | Inclusive dates (`YYYY-MM-DD`). Presets: last 7 / 30 / 60 / 90 days, or custom. |
| `revenuePeriod` | `1mo` \| `3mo` \| `6mo` |

**200:**

```json
{
  "kpis": {
    "totalOrganizations": 0,
    "activeOrganizations": 0,
    "trialOrganizations": 0,
    "totalUsers": 0,
    "mrr": 0,
    "subscriptionHealth": 0,
    "failedPayments": 0,
    "nearLimit": 0
  },
  "growthTrend": [{ "label": "W1", "signups": 0, "renewals": 0 }],
  "revenueTrend": [{ "label": "Aug", "value": 0 }],
  "planDistribution": [{ "planId": "plan-starter", "name": "Starter", "count": 0 }],
  "topOrganizations": [],
  "attentionOrganizations": [],
  "nearLimitOrganizations": [],
  "recentActivity": [],
  "recentSignups": [],
  "recentSubscriptionChanges": [],
  "platformAlerts": [],
  "platformHealth": { "label": "All systems operational", "tone": "ok" },
  "openSupportSessions": 0
}
```

`platformHealth.tone`: `ok` \| `warn` \| `danger`  
`platformAlerts[]`: `{ id, title, severity: "critical"|"warning"|"info", organizationName? }`  
`recentActivity[]`: `{ id, title, description, timeAgo, tone, link }`  
`recentSubscriptionChanges[]`: `PlanChangeRecord` (see models)

If you split this, the UI still needs every field above.

---

## 4. Organizations

Pages: `/organizations`, `/organizations/new`, `/organizations/:id`

### `GET /api/v1/organizations` — List organizations

**Used by:** Organizations list, filters, dashboard links, many dropdowns  
**Permission:** `organizations:read`  
**Query:**

| Param | Notes |
| --- | --- |
| `q` | Name, industry, country |
| `status` | `trial` \| `active` \| `past_due` \| `suspended` \| `cancelled` \| `archived` |
| `subscriptionStatus` | `trial` \| `active` \| `past_due` \| `suspended` \| `cancelled` |
| `planId` | Plan id |
| `primaryAdminId` | Primary admin id |
| `sort` | `name` \| `lastActivity` \| `users` \| `mrr` \| `createdAt` |
| `dir` | `asc` \| `desc` (default `desc` for `lastActivity`) |
| `page`, `pageSize` | Default page size 10 |

**200:** `{ items: Organization[], page, pageSize, total }`

`Organization`:

```json
{
  "id": "org-…",
  "name": "Northwind Care",
  "slug": "northwind-care",
  "status": "active",
  "planId": "plan-growth",
  "subscriptionStatus": "active",
  "industry": "Healthcare",
  "country": "United Kingdom",
  "primaryAdminId": "adm-…",
  "userCount": 0,
  "employeeCount": 0,
  "locationCount": 0,
  "mrr": 0,
  "createdAt": "2026-01-12",
  "lastActivityAt": "2026-08-28T09:15:00Z",
  "usage": {
    "users": 0, "usersLimit": 50,
    "locations": 0, "locationsLimit": 2,
    "managers": 0, "managersLimit": 8,
    "storageGb": 0, "storageLimitGb": 50
  }
}
```

### `GET /api/v1/organizations/:id` — Organization detail

**Used by:** Organization detail (all tabs)  
**Permission:** `organizations:read`  
**200:** organization plus related payloads **or** the nested endpoints below. The page needs:

- Organization
- Current plan
- Primary admin + all org admins
- Current subscription
- Effective features (plan + overrides)
- Org activity (audit)
- Support sessions for the org
- Security summary: `{ sessions, supportSessions, auditEvents }`

### `POST /api/v1/organizations` — Create organization

**Used by:** Create organization wizard  
**Permission:** `organizations:write`  
**Body:**

```json
{
  "name": "",
  "slug": "",
  "industry": "Healthcare",
  "country": "United Kingdom",
  "planId": "plan-starter",
  "status": "trial",
  "interval": "monthly",
  "seats": 50,
  "locationCount": 1,
  "usageLimits": {
    "usersLimit": 50,
    "locationsLimit": 2,
    "managersLimit": 8,
    "storageLimitGb": 50
  },
  "primaryAdmin": { "name": "", "email": "", "role": "Customer Admin" },
  "notes": ""
}
```

`status` on create: `trial` \| `active`  
`interval`: `monthly` \| `yearly`  
`primaryAdmin.role`: `Customer Admin` \| `Billing Admin` \| `Operations Admin`  
**201:** `{ id }` and created org. Also creates the primary admin (status `invited`) and a subscription. Increment plan `subscribers`.

### `POST /api/v1/organizations/export` — Export selected organizations

**Used by:** Organizations list bulk export  
**Permission:** `organizations:read`  
**Body:** `{ ids: string[] }`  
**200:** file download (CSV/XLSX). Mock currently only toasts.

### `PATCH /api/v1/organizations/:id/status` — Change organization status

**Used by:** Org detail activate / suspend / cancel / archive  
**Permission:** `organizations:write`  
**Body:** `{ status: "active"|"suspended"|"cancelled"|"archived", reason?: string }`  
`reason` required for suspend, cancel, archive.  
Also update the linked subscription status (`archived` → subscription `cancelled`).

Convenience aliases if you prefer explicit verbs:

- `POST /api/v1/organizations/:id/suspend`
- `POST /api/v1/organizations/:id/cancel`
- `POST /api/v1/organizations/:id/archive`
- `POST /api/v1/organizations/:id/activate`

### `GET /api/v1/organizations/:id/admins` — Org admins

**Used by:** Org detail Admins tab  
**Permission:** `organizations:read` or `users:read`

### `GET /api/v1/organizations/:id/subscription` — Org subscription

**Used by:** Org detail Subscription tab

### `GET /api/v1/organizations/:id/features` — Effective entitlements

**Used by:** Org detail Features tab, Entitlements drawer  
**200:** `[{ feature, source: "plan"|"override", enabled }]`

### `GET /api/v1/organizations/:id/activity` — Org audit trail

**Used by:** Org detail Activity tab  
**Query:** `limit` (mock uses 20)

### `GET /api/v1/organizations/:id/support-sessions` — Org support sessions

**Used by:** Org detail Support tab

### `GET /api/v1/organizations/:id/security-summary` — Org security snapshot

**Used by:** Org detail overview  
**200:** `{ sessions, supportSessions, auditEvents }`

---

## 5. Users & admins

Page: `/users` (tabs: Admins, Users). Profile drawers for both.

### `GET /api/v1/admins` — List customer admins

**Used by:** Users → Admins, org admin filter, invite pickers  
**Permission:** `users:read`  
**Query:** `q` (name, email, org name), `status` (`active`\|`invited`\|`deactivated`), `organizationId`, `page`, `pageSize`

`AdminUser`:

```json
{
  "id": "adm-…",
  "name": "",
  "email": "",
  "organizationId": "org-…",
  "role": "Customer Admin",
  "status": "active",
  "lastActiveAt": "",
  "avatarColor": "#4b22b3",
  "phone": "",
  "timezone": "",
  "locale": "",
  "department": "",
  "invitedAt": "",
  "joinedAt": "",
  "detailNotes": ""
}
```

### `GET /api/v1/admins/:id` — Admin profile

**Used by:** Admin profile drawer  
**200:** admin + organization + plan + subscription + recent sign-ins + recent audit for that email

### `POST /api/v1/admins` — Invite admin

**Used by:** Users invite modal, org detail invite  
**Permission:** `users:write`  
**Body:** `{ organizationId, name, email, role }`  
Creates admin with `status: "invited"` and a matching global user (`role: "Admin"`). Send invitation email.

### `POST /api/v1/admins/:id/resend-invitation` — Resend invite

**Used by:** Users list, org admins tab  
**Permission:** `users:write`  
Only valid when `status === "invited"`.

### `PATCH /api/v1/admins/:id/status` — Activate / deactivate admin

**Used by:** Users list, org admins tab  
**Permission:** `users:write`  
**Body:** `{ status: "active"|"deactivated" }`  
Keep `globalUsers` in sync by email.

### `GET /api/v1/users` — List tenant users (global directory)

**Used by:** Users → Users tab  
**Permission:** `users:read`  
**Query:** `q`, `status` (`active`\|`invited`\|`deactivated`), `organizationId`, `role` (`Admin`\|`Manager`\|`Employee`), `page`, `pageSize`

`GlobalUser`: `{ id, name, email, organizationId, role, status, lastActiveAt }`

### `GET /api/v1/users/:id` — User profile

**Used by:** User profile drawer  
**200:** user + organization + plan + subscription + sign-ins + audit

### `GET /api/v1/organizations/:id/users` — Users in an organization

**Used by:** Support “start session” user picker

### `GET /api/v1/users/:email/sign-ins` — Sign-in history for a person

**Used by:** User/admin profile drawers  
**Query:** `limit`

### `GET /api/v1/users/:email/audit` — Audit events for a person

**Used by:** User/admin profile drawers  
**Query:** `limit` (mock uses 10)

---

## 6. Subscriptions

Pages: `/subscriptions`, `/subscriptions/:id`

### `GET /api/v1/subscriptions` — List subscriptions

**Used by:** Subscriptions list, dashboard “failed payments”  
**Permission:** `subscriptions:read`  
**Query:** `q` (org name or plan name), `status` (`trial`\|`active`\|`past_due`\|`suspended`\|`cancelled`), `page`, `pageSize`

**200:** `{ items: [{ subscription, organization, plan }], page, pageSize, total, summary: { total, active, pastDue, mrr } }`

`Subscription`:

```json
{
  "id": "sub-…",
  "organizationId": "org-…",
  "planId": "plan-…",
  "status": "active",
  "interval": "monthly",
  "seats": 50,
  "amount": 0,
  "startDate": "2026-01-12",
  "renewalDate": "2026-09-12",
  "paymentStatus": "paid",
  "billingPeriodStart": "2026-08-12",
  "billingPeriodEnd": "2026-09-12",
  "cancelledAt": null,
  "cancellationReason": "",
  "pendingPlanChange": {
    "toPlanId": "plan-…",
    "effectiveDate": "2026-09-12",
    "scheduledAt": "2026-08-20T10:00:00Z",
    "note": ""
  }
}
```

`paymentStatus`: `paid` \| `failed` \| `pending` \| `n/a`

### `GET /api/v1/subscriptions/:id` — Subscription detail

**Used by:** Subscription detail  
**Permission:** `subscriptions:read`  
**200:** subscription + organization + plan + included features + plan-change history + invoices for this subscription

### `POST /api/v1/subscriptions/:id/change-plan` — Change or schedule plan

**Used by:** Subscription detail “Change plan”  
**Permission:** `subscriptions:write`  
**Body:** `{ toPlanId, note, scheduleAtPeriodEnd?: boolean }`

Rules the UI expects:

- Immediate change for upgrades (higher `priceMonthly`) unless `scheduleAtPeriodEnd` is true
- Downgrades **always** schedule at period end (`billingPeriodEnd` or `renewalDate`)
- Immediate change updates org `planId`, `mrr`, usage limits, and writes a `PlanChangeRecord`
- Scheduled change sets `pendingPlanChange` only

### `POST /api/v1/subscriptions/:id/pending-plan-change/cancel` — Cancel scheduled plan change

**Used by:** Subscription detail  
**Permission:** `subscriptions:write`

### `POST /api/v1/subscriptions/:id/retry-payment` — Retry failed payment

**Used by:** Subscription detail  
**Permission:** `subscriptions:write` or `billing:write`  
Only when `status === "past_due"`. On success: subscription `active` / `paid`, org `active`.

### `POST /api/v1/subscriptions/:id/cancel` — Cancel subscription

**Used by:** Subscription detail  
**Permission:** `subscriptions:write`  
Sets subscription `cancelled`, org `cancelled`, `mrr = 0`.

### `GET /api/v1/subscriptions/:id/plan-changes` — Plan change history

**Used by:** Subscription detail history list

---

## 7. Billing

Page: `/billing` (tabs: Overview, Invoices, Payments, Activity, Gateway)

### `GET /api/v1/billing/summary` — Billing KPIs

**Used by:** Billing overview  
**Permission:** `billing:read`  
**200:** `{ totalRevenue, openInvoices, failedPayments, refunded }`  
`totalRevenue` = sum of succeeded payments.

### `GET /api/v1/invoices` — List invoices

**Used by:** Billing invoices tab  
**Permission:** `billing:read`  
**Query:** `q` (invoice number or org name), `status` (`paid`\|`open`\|`past_due`\|`draft`\|`void`), `organizationId`, `subscriptionId`, `page`, `pageSize`  
Sort default: `issuedAt` desc.

`Invoice`: `{ id, organizationId, subscriptionId, number, amount, status, issuedAt, dueAt, paidAt? }`

### `GET /api/v1/invoices/:id` — Invoice detail

**Used by:** Invoice drawer  
**200:**

```json
{
  "invoice": {},
  "organization": {},
  "subscription": {},
  "plan": {},
  "lineItems": [{ "description": "", "quantity": 1, "unitPrice": 0, "amount": 0 }],
  "subtotal": 0,
  "taxAmount": 0,
  "total": 0,
  "currency": "INR",
  "payments": []
}
```

Do **not** leave line items / tax to the client.

### `GET /api/v1/invoices/:id/pdf` — Download invoice PDF

**Used by:** Invoice row, invoice drawer  
**Permission:** `billing:read`  
**200:** `application/pdf` (`{number}.pdf`). Creates audit event `Invoice Downloaded`.

### `POST /api/v1/invoices/export` — Bulk invoice PDF download

**Used by:** Billing invoices bulk download  
**Permission:** `billing:read`  
**Body:** `{ ids: string[] }`  
**200:** zip of PDFs (preferred) or sequential downloads.

### `GET /api/v1/payments` — List payments

**Used by:** Billing payments tab, overview failed/refunded widgets  
**Permission:** `billing:read`  
**Query:** `q` (payment id, transaction id, receipt number, gateway reference, invoice number, org name), `status` (`succeeded`\|`failed`\|`pending`\|`refunded`), `organizationId`, `invoiceId`, `page`, `pageSize`  
Sort default: `processedAt` desc.

`Payment`:

```json
{
  "id": "pay-…",
  "organizationId": "org-…",
  "invoiceId": "inv-…",
  "amount": 0,
  "status": "succeeded",
  "method": "card",
  "processedAt": "",
  "failureReason": "",
  "transactionId": "",
  "gatewayReference": "",
  "currency": "INR",
  "feeAmount": 0,
  "netAmount": 0,
  "receiptNumber": ""
}
```

### `GET /api/v1/payments/:id` — Payment detail

**Used by:** Payment drawer  
**200:** `{ payment, organization, invoice, subscription, plan }`

### `GET /api/v1/billing/activity` — Billing / subscription audit

**Used by:** Billing Activity tab and overview “recent activity”  
**Permission:** `billing:read`  
**Query:** `q`, `category` (`Billing`\|`Subscriptions`), `result` (`success`\|`warning`\|`failed`), `page`, `pageSize`

### `GET /api/v1/billing/gateway` — Payment gateway config

**Used by:** Billing Gateway tab  
**Permission:** `billing:read`  
Never return raw secrets. Masked fields only: `secretKeyMasked`, `webhookSecretMasked`.

`PaymentGatewayConfig`: `{ provider: "stripe", connected, mode: "test"|"live", publishableKey, secretKeyMasked, webhookUrl, webhookSecretMasked, lastSyncedAt, currency }`

### `PATCH /api/v1/billing/gateway` — Update gateway settings

**Used by:** Save gateway form  
**Permission:** `billing:write`  
**Body:** `{ mode, publishableKey, secretKey?, webhookUrl, webhookSecret?, currency }`  
Accept new secrets write-only; never echo them back unmasked.

### `POST /api/v1/billing/gateway/connect` — Connect Stripe

**Used by:** Gateway tab  
**Permission:** `billing:write`  
Sets `connected: true`, updates `lastSyncedAt`.

### `POST /api/v1/billing/gateway/disconnect` — Disconnect Stripe

**Used by:** Gateway tab  
**Permission:** `billing:write`

### `POST /api/v1/billing/gateway/test` — Test gateway connection

**Used by:** Gateway tab  
**Permission:** `billing:write`  
Fails if not connected. On success, refresh `lastSyncedAt`.

---

## 8. Plans & features

Pages: `/plans`, `/plans/new`, `/plans/:id`, `/plans/:id/edit`

### `GET /api/v1/plans` — List plans

**Used by:** Plans catalogue, org create, subscription change, many filters  
**Permission:** `plans:read`  
**Query:** `status` (`active`\|`draft`\|`retired`), `featureId`

`Plan`: `{ id, name, status, interval, priceMonthly, seatsIncluded, locationsIncluded, featureIds, addOnFeatureIds?, subscribers, updatedAt }`

### `GET /api/v1/plans/:id` — Plan detail

**Used by:** Plan detail  
**Permission:** `plans:read`  
**200:** plan + included features + add-on features + subscriber orgs + plan-change records involving this plan

### `GET /api/v1/plans/:id/organizations` — Orgs on this plan

**Used by:** Plan detail subscribers list

### `GET /api/v1/plans/:id/changes` — Plan change records for this plan

**Used by:** Plan detail history (`fromPlanId` or `toPlanId`)

### `POST /api/v1/plans` — Create plan

**Used by:** Create plan  
**Permission:** `plans:write`  
**Body:** `{ name, priceMonthly, seatsIncluded, locationsIncluded, interval, status, featureIds, notes? }`  
Default `status`: `draft`. Default `interval`: `monthly`. If `featureIds` omitted, include all non-optional catalogue features.  
**201:** `{ id }`

### `PATCH /api/v1/plans/:id` — Update plan

**Used by:** Plan edit  
**Permission:** `plans:write`  
**Body:** `{ name?, priceMonthly?, seatsIncluded?, locationsIncluded?, status?, featureIds? }`

### `POST /api/v1/plans/:id/retire` — Retire plan

**Used by:** Plan edit  
**Permission:** `plans:write`  
Sets `status: "retired"`.

### `GET /api/v1/features` — Feature catalogue

**Used by:** Plans features tab, plan create, entitlements, org feature overrides  
**Permission:** `plans:read` or `features:read`  
**Query:** `category` (`Workforce`\|`Analytics`\|`Documents`\|`Communication`\|`Integrations`\|`Enterprise`)

`Feature`: `{ id, name, description, category, status: "available"|"beta"|"deprecated", optional }`

---

## 9. Entitlements

Page: `/entitlements` (read-only overview). Overrides are mutated from org detail.

### `GET /api/v1/entitlements` — Entitlements by organization

**Used by:** Entitlements overview  
**Permission:** `features:read`  
**Query:** `q` (org name), `organizationId`  
**200:** `{ summary: { organizations, withOverrides, totalOverrides, featureCatalogue }, items: [{ organization, plan, enabled, overrides, total, effective }] }`

### `GET /api/v1/entitlements/activity` — Entitlement audit

**Used by:** Entitlements Activity tab  
**Permission:** `features:read`  
Filter audit where `category === "Entitlements"` or action contains `Feature`.

### `PUT /api/v1/organizations/:id/feature-overrides` — Set / update override

**Used by:** Org detail Features tab  
**Permission:** `features:write`  
**Body:** `{ featureId, enabled, reason }` — `reason` required  
Upsert. Record `updatedBy` from the session.

### `DELETE /api/v1/organizations/:id/feature-overrides/:featureId` — Remove override

**Used by:** Org detail Features tab  
**Permission:** `features:write`  
Reverts the feature to plan default.

---

## 10. Usage

Pages: `/usage`, `/usage/:orgId`

### `GET /api/v1/usage` — Usage across organizations

**Used by:** Usage list, dashboard near-limit  
**Permission:** `usage:read`  
**Query:** `q` (org name), `tone` (`healthy`\|`near`\|`limit`)

**200:** `{ summary: { healthy, near, limit }, items: [{ organization, userRatio, locationRatio, managerRatio, storageRatio, maxRatio, tone }] }`  
`tone`: `limit` if any ratio ≥ 1, `near` if ≥ 0.85, else `healthy`. Sort by `maxRatio` desc.

### `GET /api/v1/usage/:orgId` — Organization usage detail

**Used by:** Organization usage page  
**Permission:** `usage:read`  
**200:**

```json
{
  "organization": {},
  "featureUsage": [{ "featureId": "", "name": "", "activeUsers": 0, "limit": 0 }],
  "apiCalls": 0,
  "apiLimit": 50000
}
```

---

## 11. Permissions / HQ roles

Pages: `/permissions`, `/permissions/:id`

### `GET /api/v1/permission-categories` — Permission category catalogue

**Used by:** Permissions matrix and role detail  
**Permission:** `permissions:read`  
**200:** `[{ key, label, description }]` for the 12 keys listed in Conventions.

### `GET /api/v1/roles` — List HQ roles

**Used by:** Permissions roles tab, matrix selector, `GET /auth/me`  
**Permission:** `permissions:read`

`HqRoleDefinition`: `{ id, name, description, operatorCount, permissions: Record<PermissionCategoryKey, PermissionLevel>, updatedAt }`

Built-in names: `Super Admin`, `Platform Admin`, `Billing Admin`, `Support Admin`, `Security Admin`, `HQ Viewer`.

### `GET /api/v1/roles/:id` — Role detail

**Used by:** Role detail page  
**Permission:** `permissions:read`

### `PATCH /api/v1/roles/:id/permissions` — Update one matrix cell

**Used by:** Permissions matrix, role detail (cycle none → read → write → full)  
**Permission:** `permissions:write`  
**Body:** `{ category: PermissionCategoryKey, level: PermissionLevel }`  
Caller must have **write** on `permissions`. After save, any signed-in operator with that role must see nav/routes update immediately (`hqRolesEpoch` equivalent).

---

## 12. Support

Page: `/support`. Also org detail Support tab and shell banner.

### `GET /api/v1/support/sessions` — List support sessions

**Used by:** Support sessions tab  
**Permission:** `support:read`  
**Query:** `q` (org, target user, operator, reason), `status` (`active`\|`ended`), `organizationId`

**200:** `{ items: SupportSession[], summary: { active, ended, total } }`

`SupportSession`: `{ id, organizationId, targetUserName, targetUserEmail, operatorName, reason, status, startedAt, endsAt, endedAt? }`

### `POST /api/v1/support/sessions` — Start support session

**Used by:** Support page, org detail  
**Permission:** `support:write`  
**Body:** `{ organizationId, targetUserName, targetUserEmail, reason, durationMinutes? }`  
`reason` required. Default duration 60 minutes. If another session is already active for this operator, end it first. Also create a high-visibility `ActiveSession` with role `Support Session`.

### `POST /api/v1/support/sessions/:id/end` — End support session

**Used by:** Support page, shell banner  
**Permission:** `support:write`  
Sets `status: "ended"`, `endedAt`, and removes the support `ActiveSession`.

### `GET /api/v1/support/activity` — Support audit

**Used by:** Support Activity tab  
**Permission:** `support:read`  
Audit where `category === "Support"` or `supportSessionId` is set. Limit ~20.

---

## 13. Security

Page: `/security` (tabs: Audit, Sessions, Sign-ins, Alerts)

### `GET /api/v1/audit-events` — Audit log

**Used by:** Security Audit tab, billing/support/entitlement activity (can reuse)  
**Permission:** `security:read` or `audit:read`  
**Query:** `q` (actor, action, target, description), `category`, `result` (`success`\|`failed`\|`warning`), `from`, `to` (or `range=7d|30d`), `organizationId`, `page`, `pageSize`

`AuditEvent`: `{ id, timestamp, actor, action, target, category, result, description, detailNotes?, relatedRefs?: [{ label, value }], organizationId?, supportSessionId? }`

### `GET /api/v1/audit-events/:id` — Audit event detail

**Used by:** Security and billing activity drawers  
**200:** full `AuditEvent` including `detailNotes` and `relatedRefs`

### `GET /api/v1/sessions` — Active HQ / tenant sessions

**Used by:** Security Sessions tab, org security summary  
**Permission:** `security:read`  
**Query:** `risk` (`low`\|`medium`\|`high`)

`ActiveSession`: `{ id, userName, email, role, organizationName, location, device, ip, startedAt, lastSeenAt, risk }`

**200:** `{ items, summary: { total, high, medium } }`

### `POST /api/v1/sessions/:id/revoke` — Revoke session

**Used by:** Security Sessions tab  
**Permission:** `security:write`

### `GET /api/v1/sign-ins` — Sign-in activity

**Used by:** Security Sign-ins tab, user drawers  
**Permission:** `security:read`  
**Query:** `result` (`success`\|`failed`), `email`, `organizationId`

`SignInActivity`: `{ id, userName, email, organizationName, location, device, ip, timestamp, result }`

### `GET /api/v1/security/alerts` — Security alerts

**Used by:** Security Alerts tab  
**Permission:** `security:read`

`SecurityAlertItem`: `{ id, title, severity, description, timestamp }`

---

## 14. Notifications

Page: `/notifications` (Inbox, Templates). Unread count is in [Shell](#2-shell-global-chrome).

### `GET /api/v1/notifications` — Inbox

**Used by:** Notifications inbox  
**Permission:** `settings:read`  
**Query:** `q`, `category` (`organization`\|`billing`\|`usage`\|`security`\|`integration`\|`platform`), `unreadOnly=true`, `page`, `pageSize`  
Apply Super Admin filtering (hide `org_created`, `subscription_ended`, `trial_ended`). Sort `createdAt` desc.

`HqNotification`: `{ id, title, body, category, kind, organizationId?, read, createdAt }`  
`kind`: `payment_failure` \| `trial_expiring` \| `trial_ended` \| `usage_limit` \| `org_created` \| `security` \| `integration` \| `platform` \| `subscription_ended`

### `POST /api/v1/notifications/:id/read` — Mark one read

**Used by:** Opening a notification  
**Permission:** `settings:read` (own inbox)

### `POST /api/v1/notifications/read-all` — Mark all visible as read

**Used by:** Inbox “Mark all read”  
**Permission:** `settings:read`

### `GET /api/v1/notification-templates` — Templates

**Used by:** Notifications Templates tab  
**Permission:** `settings:read`

`NotificationTemplate`: `{ id, key, name, subject, channel: "email"|"in_app"|"both", category, enabled, updatedAt }`

### `PATCH /api/v1/notification-templates/:id` — Toggle template

**Used by:** Templates tab enable/disable  
**Permission:** `settings:write`  
**Body:** `{ enabled: boolean }` (or cycle the current flag)

---

## 15. Platform settings

Page: `/platform` (tabs: Settings, Flags, Integrations)

### `GET /api/v1/platform/settings` — Platform settings

**Used by:** Platform Settings tab  
**Permission:** `settings:read`

```json
{
  "platformName": "Workforce HQ",
  "supportEmail": "support@workforce.hq",
  "defaultTimezone": "UTC",
  "defaultLocale": "en-GB",
  "defaultTrialDays": 14,
  "maintenanceMode": false,
  "sessionTimeoutMinutes": 60,
  "requireMfaForHq": true,
  "notifyOnPaymentFailure": true,
  "notifyOnTrialExpiry": true
}
```

### `PATCH /api/v1/platform/settings` — Save platform settings

**Used by:** Platform Settings save  
**Permission:** `settings:write`  
**Body:** partial `PlatformSettings`. Audit the changed keys.

### `GET /api/v1/feature-flags` — Feature flags

**Used by:** Platform Flags tab  
**Permission:** `settings:read`

`FeatureFlag`: `{ id, key, name, description, enabled, rolloutPercent, environment: "all"|"production"|"staging", updatedAt }`

### `POST /api/v1/feature-flags/:id/toggle` — Enable / disable flag

**Used by:** Flags tab  
**Permission:** `settings:write`

### `PATCH /api/v1/feature-flags/:id/rollout` — Update rollout percent

**Used by:** Flags tab slider  
**Permission:** `settings:write`  
**Body:** `{ rolloutPercent: 0-100 }`  
Clamp to 0–100. Audit when the operator commits (not on every preview tick).

### `GET /api/v1/integrations` — Integration catalogue

**Used by:** Platform Integrations tab  
**Permission:** `settings:read`

`IntegrationPlaceholder`: `{ id, name, category, description, status: "connected"|"available"|"coming_soon", icon }`

### `POST /api/v1/integrations/:id/connect` — Connect integration

**Used by:** Integrations tab  
**Permission:** `settings:write`  
Only when `status === "available"`. Sets `connected`.

---

## 16. Lookups used across pages

These are consumed as dropdowns / chips, not as standalone pages.

| API | Method | Endpoint | Used by |
| --- | --- | --- | --- |
| List plans (active) | `GET` | `/api/v1/plans?status=active` | Org create, subscription change |
| List orgs (id + name) | `GET` | `/api/v1/organizations?pageSize=500` | Users, entitlements, support |
| List admins (id + name) | `GET` | `/api/v1/admins` | Organizations admin filter |
| Industries / countries | — | Can be static on the client for now. Create org options: Healthcare, Retail, Hospitality, Logistics, Security, Technology, Education, Manufacturing, Professional Services, Other. Countries: UK, Ireland, US, Netherlands, Germany, France, UAE, Australia. |

---

## 17. Access denied

Page: `/access-denied`  
No dedicated API. Access is decided from `GET /api/v1/auth/me` permissions plus route metadata.

---

## Page → API index

| Frontend route | Required APIs |
| --- | --- |
| `/auth/login` | `POST /auth/login` |
| `/auth/register` | `POST /auth/register` |
| `/auth/forgot-password` | `POST /auth/forgot-password` |
| Shell (all authenticated) | `GET /auth/me`, `GET /search`, `GET /notifications/unread-count`, `GET /support/sessions/active`, `POST /auth/logout`, `POST /support/sessions/:id/end` |
| `/dashboard` | `GET /dashboard` |
| `/organizations` | `GET /organizations`, `POST /organizations/export` |
| `/organizations/new` | `GET /plans`, `GET /features`, `POST /organizations` |
| `/organizations/:id` | `GET /organizations/:id` (+ nested), status mutations, invite admin, feature overrides, start support |
| `/users` | `GET /admins`, `GET /admins/:id`, `GET /users`, `GET /users/:id`, invite / resend / status |
| `/permissions` | `GET /roles`, `GET /permission-categories`, `PATCH /roles/:id/permissions` |
| `/permissions/:id` | `GET /roles/:id`, `PATCH /roles/:id/permissions` |
| `/subscriptions` | `GET /subscriptions` |
| `/subscriptions/:id` | `GET /subscriptions/:id`, change-plan, cancel pending, retry payment, cancel |
| `/billing` | summary, invoices, payments, activity, gateway CRUD/test, PDF export |
| `/plans` | `GET /plans`, `GET /features` |
| `/plans/new` | `GET /features`, `POST /plans` |
| `/plans/:id` | `GET /plans/:id` (+ orgs, changes) |
| `/plans/:id/edit` | `GET /plans/:id`, `PATCH /plans/:id`, `POST /plans/:id/retire` |
| `/entitlements` | `GET /entitlements`, `GET /entitlements/activity` |
| `/usage` | `GET /usage` |
| `/usage/:orgId` | `GET /usage/:orgId` |
| `/support` | sessions list/start/end, support activity, org users picker |
| `/security` | audit, sessions, revoke, sign-ins, alerts |
| `/notifications` | inbox, mark read, templates toggle |
| `/platform` | settings, flags, rollout, integrations connect |
| `/access-denied` | none |

---

## Core TypeScript models (source of truth)

Implement payloads to match `src/app/core/models/hq.models.ts` and `src/app/core/models/auth.models.ts`. Do not invent parallel field names if the UI already has one.

---

## Out of scope for this file

- Internal Stripe webhook handlers (except that `webhookUrl` is stored/shown on Billing → Gateway)
- Tenant (customer-app) APIs — this catalogue is **Workforce HQ** only
- Real-time push; polling `GET /notifications/unread-count` and `GET /support/sessions/active` is enough for the current UI
