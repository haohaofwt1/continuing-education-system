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
