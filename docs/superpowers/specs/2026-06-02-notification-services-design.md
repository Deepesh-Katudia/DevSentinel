# Notification Services — Design Spec

**Date:** 2026-06-02  
**Status:** Approved  

---

## Context

The Organisation Settings page (`/settings/organisation?tab=notifications`) has a "Notification Services" tab that currently renders a hardcoded `ComingSoonPanel`. The description already commits to the intended feature: configure channels to alert the team when incidents are created or PR reviews complete.

This spec covers the first live implementation of that feature: **email delivery via Resend**, admin-configurable recipients, triggered by new incidents (all severities) and completed PR reviews.

---

## Architecture

### Data Model

New table: `notification_channels`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID string PK | |
| `org_id` | FK → organizations | cascade delete |
| `channel_type` | string | `"email"` now; extensible to `"slack"`, `"webhook"` |
| `name` | string(120) | friendly label e.g. "On-call team" |
| `config` | Text (JSON) | `{"emails": ["a@b.com"]}` |
| `events` | Text (JSON) | `["incident_created", "pr_review_completed"]` |
| `is_enabled` | bool | default `true` |
| `created_at` | datetime | |

Config is JSON so future channel types only require a new key, not a schema change. Events are per-channel so each channel independently subscribes to triggers.

---

## Backend

### New files

**`apps/api/models/notification.py`**
- `NotificationChannel` SQLAlchemy model matching the schema above
- Relationship to `Organization`

**`apps/api/alembic/versions/007_add_notification_channels.py`**
- Migration: `CREATE TABLE notification_channels`

**`apps/api/services/email_service.py`**
- `async send_incident_notification(org_id: str, incident: Incident, db: AsyncSession)` — queries enabled channels with `"incident_created"` in events, sends email per channel
- `async send_pr_review_notification(org_id: str, pr: PullRequest, db: AsyncSession)` — same for `"pr_review_completed"`
- `async _send_via_resend(to: list[str], subject: str, html: str)` — calls `https://api.resend.com/emails` with `RESEND_API_KEY`

**`apps/api/routers/notifications.py`**  
Mounted at `/notifications`, auth-gated via existing `verify_supabase_token` + `get_verified_org_id` middleware.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/notifications/channels` | member | List org channels |
| POST | `/notifications/channels` | admin | Create channel |
| PATCH | `/notifications/channels/{id}` | admin | Update channel |
| DELETE | `/notifications/channels/{id}` | admin | Delete channel |
| POST | `/notifications/channels/{id}/test` | admin | Send test email |

### Changes to existing files

**`apps/api/models/database.py`**
- Add `resend_api_key: str = ""` to `Settings`

**`apps/api/main.py`**
- Include `notifications.router` with prefix `/notifications`

**`apps/api/routers/webhooks.py`** — two hooks using `BackgroundTasks`:
1. After creating an `Incident` row → `background_tasks.add_task(send_incident_notification, org_id, incident, db)`
2. After the AI PR review completes → `background_tasks.add_task(send_pr_review_notification, org_id, pr, db)`

Using `BackgroundTask` ensures the webhook handler returns `200` immediately (keeping GitHub/Sentry happy) while email fires after.

---

## Frontend

### New file

**`apps/web/components/settings/notification-services-tab.tsx`**

Exported as `NotificationServicesTab`. Three card panels matching the existing `#f2ece5` / `var(--border)` design system:

**Card 1 — Channel list**
- Fetches `GET /notifications/channels` on mount
- Each row: channel name, email addresses (truncated), enabled toggle, edit/delete buttons
- Admin only: edit/delete controls; members see read-only view
- Empty state message; loading skeletons

**Card 2 — Add / Edit form** (inline, opens via "Add channel" or row edit click)
- Fields: Name (text input), Email addresses (tag-style input — comma-separated, validated as email format), Events (two checkboxes: "New incident" and "PR review completed"), Enabled toggle
- Uses existing `InteractiveHoverButton` for Save/Cancel
- On save: `POST /notifications/channels` (new) or `PATCH /notifications/channels/{id}` (edit)

**Card 3 — Test** (visible only when ≥1 channel exists)
- "Send test email" button per channel
- Fires `POST /notifications/channels/{id}/test`
- Shows inline success/error message

### Change to existing file

**`apps/web/app/(app)/settings/organisation/page.tsx`**
- Import `NotificationServicesTab`
- Replace the `ComingSoonPanel` block for `activeTab === "notifications"` with `<NotificationServicesTab />`

---

## Email content

**Incident created:**
- Subject: `[DevSentinel] New {severity} Incident: {title}`
- Body: incident title, severity, status, link to `/dashboard/incidents/{id}`

**PR review completed:**
- Subject: `[DevSentinel] AI Review Ready: {pr_title}`
- Body: repo name, PR number/title, summary sentence, link to PR on GitHub

Plain HTML emails. No external template engine needed.

---

## Environment variables

```
RESEND_API_KEY=re_xxxxxxxxxxxx   # new — Resend API key
```

---

## Verification

1. Add a notification channel in the UI — confirm it appears in the list
2. Toggle enabled/disabled — confirm it persists
3. Use "Send test email" — confirm delivery in inbox
4. Create a new incident via the Sentry webhook or manually — confirm email arrives
5. Trigger a PR review completion — confirm PR review email arrives
6. Delete a channel — confirm no further emails are sent
7. Non-admin member — confirm edit/delete controls are hidden
