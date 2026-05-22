# Commercial Standardization

This document standardizes the four launch areas for the system before deploying to Vercel and selling commercially.

## 1. Required Production Foundation

Commercial launch requires:

- PostgreSQL as the only source of truth.
- Auth.js sessions with real users, roles and permissions.
- Server-side permission checks on all mutating APIs.
- Audit logs for sensitive events.
- Private file storage with signed URLs.
- Clear health checks and no raw framework errors visible to users.

Current standard:

- Use `/api/health` and `/admin/health` before deploy.
- Production must set `NEXT_PUBLIC_DEMO_FALLBACK=false`.
- Production must not use `AUTH_SECRET="replace-with-a-secure-random-secret"`.
- Production must not use `STORAGE_PROVIDER=local` for real certificate files.

## 2. Business Workflow Completeness

Commercial workflow must cover:

- Employee lifecycle: create, update, lock, import, export, audit.
- Certificate lifecycle: upload, OCR, confirm, review, approve, reject, request supplement, exclude from cycle.
- Training cycle: active cycle, required hours by position/department, summary recalculation.
- Reports: saved filters, Excel/PDF export, shared report token, QR verification.
- Discuss: channels, direct messages, members, attachments, read receipts and realtime delivery.

Current standard:

- Demo text must be removed from customer-facing screens before launch.
- Destructive actions should lock/archive when history matters.
- Every export/share should write an audit log.

## 3. AI-Native Product Layer

AI should operate through safe tools, not uncontrolled database access.

Required AI behavior:

- OCR extracts structured certificate fields with confidence.
- AI flags low-confidence values and suggests corrections.
- AI detects duplicates and data quality issues.
- AI creates report drafts from natural language.
- AI drafts reminders but requires human confirmation before sending.
- AI tools enforce tenant, role and permission scope.

Current standard:

- Do not send the full database to the model.
- Mutating AI actions need preview and confirmation.
- AI actions must be logged in `AuditLog`.

## 4. UI, Branding And Admin Polish

Commercial UI should feel operational and trustworthy.

Standard UI direction:

- Font: Be Vietnam Pro or Inter.
- Layout: denser admin screens, clear tables, drawers for detail/edit, predictable filters.
- Colors: teal primary, emerald success, amber warning, red danger, slate neutral.
- Radius: 8-12px for dense operational UI; larger cards only where needed.
- Dashboard: role-aware widgets, drilldown from metric to list, cycle/department filters.
- Admin: health check, roles, permissions, storage, OCR, AI, API keys, audit logs and tenant settings.

## Vercel Launch Gate

Do not launch commercially until:

- `/api/health` returns `ready: true`.
- `/admin/health` has no failed checks.
- Employees, Certificates, Training and Reports are database-backed.
- Storage provider is not `local`.
- Auth secret is production-safe.
- Demo fallback is disabled.
- OpenAI/OCR provider is configured if AI/OCR is sold as part of the product.
