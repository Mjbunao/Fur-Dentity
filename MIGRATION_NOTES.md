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
- Adoption page migration started with shelter/adopted pet tables, add/edit pet modal, breed dropdowns from Firebase catalogs, pet details page, adoption request review, and role-aware delete-request workflow.
- Donation and adoption delete-request review tables now support sorting.
- System-admin pending delete requests can now be canceled instead of leaving the request button disabled.
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

### 2026-04-13

Done:

- Migrated the legacy adoption feature into the Next.js dashboard with a server-backed adoption directory.
- Added shelter/adopted tabs, searchable/sortable/paginated MUI table layout, add/edit pet dialog, and adoption details page.
- Added breed dropdown support for adoption pet creation/editing using Firebase breed catalogs.
- Added adoption request viewing on the pet details page with accept/reject actions based on the legacy request data shape.
- Added adoption delete-request workflow matching donations:
  - `system_admin` can request deletion.
  - `super_admin` reviews and approves/rejects the request.
  - resolved request records are removed from Realtime Database.
- Added view links and `yyyy-mm-dd HH:mm` timestamp formatting to donation/adoption delete-request review tables.
- Added sorting to both donation and adoption delete-request review tables.
- Changed pending delete-request buttons for donation/adoption from disabled `Requested` buttons into active `Cancel Request` buttons.
- Added server-side cancel endpoints that clear `requestStatus`, `deleteRequestId`, and `deleteRequestByUid` from the target record and remove the linked pending request node.

Next:

- Runtime-test the adoption cancel-request flow with a freshly created request, because older pending requests may not have the new `deleteRequestId` metadata.
- Continue migrating the next legacy dashboard feature page-by-page.
- Keep using the established MUI design rules: Montserrat, theme primary/warning colors, compact tables, 10px action button radius, reduced modal/table radius, and icon + label on buttons.
- Optionally clean the remaining shell warning by removing the unused `colors` import from `DashboardShell.tsx`.

### 2026-04-14

Done:

- Continued stabilizing the adoption feature after the first migration pass.
- Fixed adoption request loading/counting around the legacy request node shape:
  - valid request records are read from `catalogs/petShelterList/{petId}/request/{requestId}/userID`.
  - placeholder/invalid child nodes such as raw `userID` keys are filtered out and should not count as real requests.
- Kept adoption request accept/reject behavior inside the adoption details page.
- Added/kept donation and adoption delete-request detail/view support with readable timestamps.
- Updated donation and adoption delete-request timestamps to include both date and time.
- Added sorting to adoption delete-request review tables.
- Migrated the reports/ticketing feature into the dashboard with server-backed APIs and a report details page.
- Added reports delete behavior following the donation/adoption pattern:
  - `system_admin` requests deletion.
  - `super_admin` reviews and approves/rejects.
  - direct super-admin deletion remains available.
- Refined report table layout and labels:
  - report type shows `Missing` or `Found`.
  - registration status is displayed as supporting subtext.
  - action column spacing was tightened.
  - report details heading capitalization was fixed.
- Discussed the activity log/timeline feature and agreed to log admin actions first before mobile-created events.
- Decided activity logs should include actor, action, subject, target, timestamp, and metadata.
- Decided activity logs are audit records and should not have edit/delete UI.

Next:

- Implement the admin activity log system server-side.
- Add a super-admin-only Activity Logs page.
- Continue verifying deletion workflows remove or update the matching Firebase records instead of only hiding UI rows.

### 2026-04-15

Done:

- Added server-side activity logging for admin actions across the migrated dashboard:
  - admin login/logout
  - user deletion
  - pet deletion
  - system-admin create/status/delete/password-change actions
  - donation create/update/delete/delete-request actions
  - adoption create/update/delete/delete-request actions
  - adoption request accept/reject actions
  - report status/delete/delete-request actions
- Fixed duplicate login activity logs by making the login page create the secure admin session from one guarded `onAuthStateChanged` path.
- Added an `activityLogs` dashboard section for `super_admin` only, with a searchable, paginated, role-filtered table.
- Added clickable activity log rows and a dedicated activity log details page that presents the audit record as a readable sentence instead of raw label-by-label data.
- Kept activity logs as audit-only records with no edit/delete UI.
- Standardized required field indicators on active forms and enforced numeric-only input for number-like fields:
  - donation amount
  - donation contact number
  - adoption pet age
- Tightened delete consistency rules:
  - direct super-admin deletes for donation/adoption/reports also clean up linked pending delete-request nodes.
  - UI rows are only removed after server/database success.
- Refactored main data tables toward the new browse-only pattern:
  - Users, Pets, Donation, Adoption, Reports, and Activity Logs now use clickable rows to open details pages.
  - Main record table action columns were removed where details pages now own the actions.
  - Details pages now hold edit/delete/request-delete/cancel-request actions for Donation and Adoption.
  - Reports details page remains the owner of status update/delete/request-delete/cancel-request.
- Intentionally kept action buttons inside action/review tables:
  - System Admin table remains an action table.
  - Donation/Adoption/Report delete-request review tables keep approve/reject actions.

Current UI/UX rule:

- Main record tables are for browsing/searching/sorting only.
- Clicking a main table row opens the details page.
- Record-changing actions belong on the details page.
- Action queues and management tables can keep inline buttons when that is the main purpose of the table.

Next:

- Browser-test details-page actions after the row-click refactor:
  - donation edit/delete/request/cancel
  - adoption edit/delete/request/cancel
  - report delete/request/cancel/status update
  - users/pets details-page delete
- Continue migrating remaining legacy dashboard sections feature-by-feature.
- Keep all privileged mutations server-verified and activity-logged when they change important records.

### 2026-04-16

Done:

- Migrated the dashboard overview into the Next.js dashboard with server-backed summary data.
- Added dashboard metric cards for users, pets, shelter/adopted pets, monthly reports, adoption requests, and monthly donations.
- Added dashboard chart-style summaries without an external chart library:
  - missing vs found reports by month
  - adopted pets by month
  - donation amount by month
- Added role-aware dashboard queue cards:
  - `super_admin` sees pending delete requests needing review.
  - `system_admin` sees their own pending delete requests.
- Fixed the dashboard total users card link so it opens the user list instead of being treated like a user-details route.
- Replaced the Adoption Requests dashboard icon with `PetsSharpIcon` because it better communicates pet/adoption activity.
- Migrated admin notifications into the dashboard header:
  - notification bell dropdown
  - unread badge
  - all/unread filter
  - mark read and clear actions
  - clickable notifications that open the related page
  - polling refresh so notifications update without a full browser refresh
- Added notification state persistence under the admin account so read/unread status is not reset when using another browser.
- Added notification support for delete request approval/rejection outcomes so system admins can see whether their request was approved or rejected.
- Adjusted super-admin notification behavior so approving/rejecting a request keeps the original notification context instead of replacing it with a different message or re-highlighting it.
- Refined notification UI:
  - smaller filter/action buttons
  - larger notification heading area
  - borderless bell/profile surfaces
  - compact dropdown layout
- Updated dashboard and page surfaces from border-heavy containers to shadow-based cards.
- Changed the dashboard workspace background to `bg-slate-100` so white cards stand out from the page.
- Removed visible shell borders from the sidebar and sticky header, replacing them with subtle shadows.
- Converted table containers and pending dashboard queue cards away from visible borders toward soft shadows/fills.
- Made the overall admin UI more compact:
  - reduced main content padding
  - tightened card padding and section spacing
  - reduced shared detail-card spacing
  - reduced MUI input/button/table/tab vertical padding
- Updated page descriptions to better match each module purpose:
  - Users
  - Pets
  - System Admins
  - Donation
  - Adoption
  - Reports
  - Activity Logs
  - Delete request review tables
- Strengthened Montserrat usage across the project:
  - body now receives the actual Montserrat class
  - Tailwind `--font-sans` maps to `--font-montserrat`
  - MUI Typography and InputBase are explicitly set to the Montserrat font family
- Fixed the Report Delete Requests empty/loading state alignment by using the correct table `colSpan`.
- Verified the latest UI/style changes with `npx tsc --noEmit`.

Current UI/UX rule:

- Use compact page spacing by default.
- Main page containers should feel raised with shadows instead of visible borders.
- Sidebar/header surfaces should stay clean and mostly borderless.
- Main data tables remain browse/search/sort surfaces; record-changing actions live in details pages.
- Action/review tables can keep inline buttons when that table is specifically for approval/rejection or account management.
- Montserrat is the required global font across Tailwind, MUI, and plain text.

Next:

- Browser-test the dashboard overview and notification behavior under both `super_admin` and `system_admin`.
- Continue migrating remaining legacy dashboard sections feature-by-feature.
- Keep all privileged mutations server-verified, activity-logged, and consistent with the delete-request cleanup rules.
- Consider removing old commented/dead dashboard shell code later if it becomes noisy, but it is not blocking current runtime behavior.
