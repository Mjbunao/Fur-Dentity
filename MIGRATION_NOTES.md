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
- Users page migrated from the legacy project into a new MUI-based table flow with search, sticky headers, sorting, pagination, user details dialog, and super-admin-only delete action.
- Protected users API routes added for listing users, loading user details with pets, and deleting users through server-verified requests.

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
