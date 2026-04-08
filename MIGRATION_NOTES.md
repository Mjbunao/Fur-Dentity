# Fur-Dentity Migration Notes

## Purpose

This file is the running handoff note for the Fur-Dentity web migration.
Update it at the end of each work session so future sessions can quickly recover:

- current architecture
- completed work
- in-progress work
- next planned steps
- important decisions and constraints

## Source Projects

- Legacy web project: `C:\Users\LRMS2\Fur-Dentity_Website`
- Current Next.js project: `C:\Users\LRMS2\Desktop\fur-dentity`

## Migration Goal

Refactor the legacy static/Firebase admin website into a Next.js app while keeping the codebase structured enough to migrate away from Firebase later if needed.

## Architecture Decisions

- Use Firebase Auth for web admin identity.
- Use the Realtime Database `admins/{uid}` record for role and profile data.
- Supported web admin roles:
  - `super_admin`
  - `system_admin`
- Build the full admin web first from the `super_admin` perspective.
- When implementing features, mark them as either:
  - shared (`super_admin` + `system_admin`)
  - `super_admin` only
- Do not rely on client-side hiding alone for permissions. Server-side enforcement is required for privileged actions.
- Keep auth/session logic isolated in app-owned modules so future migration away from Firebase is manageable.

## Current Auth Model

- Login uses Firebase Auth email/password.
- After Firebase login, the app verifies `admins/{uid}`.
- The server creates a signed `httpOnly` session cookie.
- Protected dashboard routes are guarded by:
  - server session checks
  - route proxy cookie presence checks

## Files Added For Auth

- `lib/firebase-config.ts`
- `lib/auth/types.ts`
- `lib/auth/session.ts`
- `lib/auth/firebase-server.ts`
- `app/api/session/login/route.ts`
- `app/api/session/logout/route.ts`
- `proxy.ts`
- `.env.example`

## Files Updated For Auth

- `app/page.tsx`
- `app/(dashboard)/layout.tsx`
- `app/(dashboard)/DashboardShell.tsx`
- `lib/firebase.ts`

## Current Dashboard Structure

- Shared dashboard shell exists.
- Sidebar routes currently available:
  - `/dashboard`
  - `/reports`
  - `/adoption`
  - `/donation`
  - `/users`
  - `/pets`
  - `/gps-devices`
- Placeholder pages exist for these routes.

## Environment Setup

Create `.env.local` in the project root with:

```env
SESSION_SECRET=replace-with-a-long-random-secret
```

The session system will not work without this variable.

## Current Status

Completed:

- Legacy project analyzed.
- Next.js project analyzed.
- Login migrated away from legacy plaintext `web-admin` lookup.
- Firebase Auth email/password login implemented.
- `admins/{uid}` role-based authorization implemented.
- Signed server session cookie implemented.
- Dashboard shell and placeholder routes implemented.
- Secure `super_admin` login verified working end to end.
- Realtime Database rules confirmed must allow authenticated users to read their own `admins/{uid}` record.
- Super-admin-only system-admin account creation feature implemented.
- Forced password-change flow implemented for newly created `system_admin` accounts.
- Users page migrated from the legacy project into a new MUI-based table flow with search, sticky headers, sorting, pagination, nested details page, and super-admin-only delete action.
- Protected users API routes added for listing users, loading user details with pets, and deleting users through server-verified requests.
- Pets page migrated into the Next.js dashboard with a matching MUI inventory table, nested details page, and super-admin-only delete action.
- `Users` sidebar route converted into an expandable parent item with nested `User Directory` and `System Admin` links.
- `System Admin` management page added with a searchable, sortable, paginated MUI table, create-account modal, status toggle, delete action, and immediate refresh after account creation.
- Session revalidation route added so deactivated/deleted admins lose dashboard access on the next validation cycle.
- Shared MUI confirmation dialog added for delete actions across users, pets, and system admins.
- Donation page migrated into the Next.js dashboard with a shared inventory for both admin roles, role-aware delete flow, dedicated details page, create/edit dialog, and super-admin review table for delete requests.
- Donation delete requests now persist request status on the donation record so refreshes do not allow duplicate requests, and resolved request records are removed from Realtime Database.
- UI standards established and applied across current pages:
  - Montserrat as the main font
  - primary/warning theme colors as the project palette
  - icon + label on action buttons by default
  - tighter 10px button radius
  - reduced table/card radius
  - matching dialog/modal radius
  - small MUI text fields as the standard input style

In progress:

- Migrating dashboard features from the legacy project one feature at a time.

Not done yet:

- System-admin permission filtering across features.
- Feature-by-feature migration of legacy dashboard sections into Next.js pages/components.
- Full server-side authorization for privileged mutations.
- Runtime testing of the new users page against current Realtime Database `users` and `pets` rules.

## Working Rules

- Before editing, rescan the relevant current files.
- When converting features from the legacy project, treat each feature as:
  - shared
  - or `super_admin` only
- Avoid rebuilding legacy patterns like `innerHTML` section injection.
- Prefer route/page/component architecture in Next.js.

## Session Log

### 2026-03-31

Done:

- Added shared dashboard shell and placeholder routes.
- Added top nav with notification/profile UI.
- Switched app font to Montserrat.
- Added custom Tailwind theme tokens.
- Replaced old client-side `web-admin` login with Firebase Auth email/password.
- Added signed session cookie flow using `jose`.
- Added protected dashboard session checks through layout and proxy.
- Verified secure `super_admin` login works after fixing Realtime Database rules for `admins/{uid}` reads.
- Added super-admin-only system-admin account creation on the `Users` route.
- Added forced password-change route and session refresh so new `system_admin` accounts must update their temporary password before dashboard access.
- Migrated the legacy `users` section into the Next.js `/users` page.
- Added a Material UI users table with search, sticky header, sorting, pagination, and a details dialog showing registered pets.
- Added protected `/api/users` and `/api/users/[userId]` route handlers.
- Added super-admin-only user deletion on the new users page.

Next:

- Continue migrating dashboard features from the legacy project one feature at a time.
- Mark each new feature as shared or `super_admin` only.
- Test the new users page in the browser and verify Realtime Database rules allow the protected server routes to read `users` and `pets` and delete `users` when invoked by `super_admin`.

### 2026-04-07

Done:

- Migrated the pets inventory and pet details flow into the Next.js dashboard.
- Reworked user and pet details from modal-style viewing into nested pages under the dashboard shell.
- Added nested `Users` navigation in the sidebar with role-aware visibility/locking behavior.
- Added a dedicated `System Admin` management section with list, create, activate/deactivate, and delete flows.
- Added role-aware session revalidation so deactivated or removed admins lose dashboard access on the next validation check.
- Standardized current UI surfaces around the approved design system:
  - Montserrat
  - primary/warning color theme
  - icon + label action buttons
  - tighter button, table, and dialog radii
  - compact MUI table layout and small text fields
- Replaced browser delete confirms with a shared Material UI confirmation dialog.

Next:

- Continue migrating the next legacy dashboard feature page-by-page.
- Keep applying the approved design system defaults to new pages and forms.
- Optionally clean the remaining shell warning by removing the unused `colors` import from `DashboardShell.tsx`.

### 2026-04-08

Done:

- Migrated the legacy donation feature into the Next.js dashboard with server-backed routes and the approved shared/super-admin delete workflow.
- Added donation create/edit flow, dedicated donation details page, and a super-admin delete-request review table.
- Updated donation filtering so the table uses a date picker-style month/year field instead of the earlier combined dropdown approach.
- Formatted donation delete-request `Requested At` values as `yyyy-mm-dd`.
- Styled donation actions to follow the approved project UI rules, including warning-colored edit buttons and red delete/request-delete buttons.
- Fixed donation request persistence so a system admin cannot submit duplicate delete requests after refreshing the page.
- Updated the donation delete-request resolution flow so resolved request records are removed from Realtime Database instead of being left behind.

Next:

- Continue migrating the next legacy dashboard feature page-by-page.
- Keep donation/server-side patterns consistent for the remaining features.
- Optionally clean the remaining shell warning by removing the unused `colors` import from `DashboardShell.tsx`.
