# Commercial Readiness

This project is being moved from MVP/demo mode to a commercial-grade product. The target architecture is:

- PostgreSQL as the source of truth.
- Prisma migrations for all schema changes.
- Auth.js with Prisma-backed users, roles and permissions.
- Object storage for certificate files, not browser localStorage.
- Background OCR jobs, not blocking UI upload flows.
- Audit logs for critical changes.
- Realtime Discuss through Supabase Realtime or WebSocket.

For the AI-first product roadmap, see [AI-Native Commercialization Plan](./AI_NATIVE_COMMERCIALIZATION_PLAN.md).

## Current Production-Ready Progress

- Prisma schema already covers core LMS/CME entities: users, roles, permissions, departments, positions, certificates, files, OCR results, training cycles, summaries, reports, shared reports, audit logs, API keys, notifications and future LMS models.
- Commercial foundation has been added:
  - Multi-tenant SaaS foundation through `Tenant`, tenant-scoped core models and `TenantUsageRecord`.
  - Billing/limit fields for users, certificates/month, OCR pages/month, AI messages/month, storage and retention.
  - Certificate review event history through `CertificateReviewEvent`.
  - Async OCR queue table through `OcrJob`.
  - Report export artifacts through `ReportArtifact`.
  - AI workflow audit through `AiActionLog`.
  - Production readiness now fails/warns on missing tenant tables, object storage, insecure secrets and enabled demo fallback.
- Sprint 1 data foundation has started:
  - `GET/POST /api/employees` now uses Prisma when PostgreSQL is available and returns `EMPLOYEES_DATABASE_UNAVAILABLE` when it is not.
  - `PATCH/DELETE /api/employees/:id` now updates/locks users through Prisma.
  - `GET/POST /api/certificates` now uses Prisma when PostgreSQL is available and returns `CERTIFICATES_DATABASE_UNAVAILABLE` when it is not.
  - `PATCH/DELETE /api/certificates/:id` now updates/deletes certificates through Prisma.
  - Employees and Certificates screens are API-first and fall back to demo storage only when the database API is unavailable.
  - Server-side permission and audit helpers are in place for these APIs.
- Discuss now has real database models:
  - `Conversation`
  - `ConversationMember`
  - `Message`
  - `MessageAttachment`
  - `MessageReadReceipt`
- Discuss has API routes:
  - `GET /api/discuss/threads`
  - `POST /api/discuss/threads`
  - `GET /api/discuss/messages?conversationId=...`
  - `POST /api/discuss/messages`
- The Discuss UI calls the database API first and falls back to demo mode only when the database is not available.
- Training plan workflow has been modeled:
  - `TrainingPlan` stores each employee's target hours, current hours, missing hours, due date, assignee and status for a cycle.
  - `TrainingReminder` stores scheduled/sent reminder events by channel.
  - The Training screen now derives a practical plan from missing hours and explains the rollover rule after a cycle ends.
- Certificate upload/OCR now evaluates whether the extracted study/end or issued date belongs to the active cycle. Certificates outside the active cycle are still stored as evidence, but their hours are not counted toward the current cycle.
- Individual compliance-cycle foundation has been added:
  - `CompliancePolicy` defines rules such as 120 periods / 5 years and annual minimums.
  - `EmployeeComplianceCycle` stores each employee's own start/end date, required hours, approved hours, missing hours and status.
  - `CreditRecord` links approved certificate hours to the correct employee cycle by credit date.
  - Employee profiles now capture license issue/start date so the system can derive a personal 5-year cycle instead of relying only on one global unit cycle.
  - The Training screen now shows each employee's personal cycle window and uses policy hours for compliance calculations.
- Organization master data has been expanded for commercialization:
  - Departments can carry codes and responsible managers.
  - Positions can carry a default compliance policy, required hours, annual minimum hours and CCHN requirement.

## CME Rule Notes for Vietnam

- Licensed medical practitioners in examination/treatment are tracked with a default rule of 48 training periods in 2 consecutive years.
- Other health workers can be configured with the 120 training periods in 5 consecutive years rule, including a minimum annual threshold where needed.
- Multiple valid continuing training forms can be accumulated within the applicable cycle.
- When a cycle closes, the system should freeze summaries and reports, create the next cycle, and start counting new-cycle hours from zero. Old certificates remain in the evidence archive and should only be counted if assigned to the cycle that matches their training/completion date.
- For large deployments, the recommended operational model is server-side summary calculation: when a certificate is approved, create/update a `CreditRecord`, attach it to the employee cycle matching the credit date, and recalculate `EmployeeComplianceCycle`/`TrainingSummary` in the database. Dashboards should read summaries instead of scanning all certificates on every page load.

## Required Local Setup

Create `.env` from `.env.example`, then configure a real PostgreSQL database:

```bash
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

## Next Commercial Milestones

1. Replace remaining localStorage modules with API/database:
   - employees
   - certificates
   - training settings
   - reports
   - admin categories/API keys/QR

2. Make file storage production-safe:
   - Supabase Storage or Cloudflare R2 adapter
   - private files with signed URLs
   - thumbnails generated server-side

3. Make OCR production-safe:
   - queue table or background worker
   - provider adapter for OpenAI Vision / Google Vision / Document AI
   - store raw text and structured extraction in `CertificateOcrResult`

Current implementation status:

- `/api/ocr` can enqueue `OcrJob` by `certificateId` and can process a job immediately with `processNow` for simple deployments.
- Real background workers still need to be connected for production-scale OCR throughput.

4. Harden security:
   - server-side permission checks on all API routes
   - hashed API keys only
   - audit log before/after values
   - upload validation and size limits

5. Add realtime Discuss:
   - read receipts
   - typing indicators
   - attachments
   - message edit/delete
  - channel membership and private channels

## Production Mode Rules

- Set `NEXT_PUBLIC_DEMO_FALLBACK=false` in production.
- Run `npm run prisma:migrate` against PostgreSQL before first launch.
- Use an object storage provider, not `STORAGE_PROVIDER=local`.
- Configure `STORAGE_PUBLIC_BASE_URL` so file/report URLs can be resolved.
- Use `/api/health` and `/admin/health` as launch gates; production should have no failed checks.
