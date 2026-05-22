# AI-Native Commercialization Plan

Mục tiêu không chỉ là "gắn ChatGPT vào hệ thống", mà là biến hệ thống thành sản phẩm vận hành thông minh: dữ liệu đúng, quyền đúng, quy trình đúng, AI chỉ hành động trong phạm vi được kiểm soát.

## Product Principles

1. Database is the source of truth. No commercial feature should depend on browser localStorage.
2. AI is a copilot, not an uncontrolled admin. Every AI action must be explainable, permission-scoped, auditable and reversible.
3. Upload and OCR must be asynchronous. Users should not wait on OCR in the main UI flow.
4. Reports must be reproducible. Every exported report should have saved filters, creator, generated time and source data scope.
5. Tenant data must never leak. Multi-tenant isolation is a product feature, not an infrastructure afterthought.

## Phase 1: Commercial MVP Nội Bộ

### 1. PostgreSQL First

Replace these remaining demo/localStorage paths with Prisma-backed API routes:

- Employees: `components/employees/employees-client.tsx`
- Certificates: `components/certificates/certificates-client.tsx`
- Training settings and summaries: `components/training/training-client.tsx`
- Reports: `components/reports/reports-client.tsx`
- Admin categories, API keys and QR: `components/admin/admin-management-clients.tsx`
- Dashboard and topbar counts: `components/dashboard/dashboard-client.tsx`, `components/layout/topbar.tsx`, `components/layout/sidebar.tsx`

Recommended API shape:

- `GET/POST /api/employees`
- `GET/PATCH/DELETE /api/employees/:id`
- `GET/POST /api/certificates`
- `GET/PATCH/DELETE /api/certificates/:id`
- `POST /api/certificates/:id/review`
- `POST /api/certificates/:id/approve`
- `POST /api/certificates/:id/reject`
- `GET/POST /api/training-cycles`
- `POST /api/training-summaries/recalculate`
- `GET/POST /api/reports`
- `POST /api/reports/:id/export`

### 2. Auth And Permissions

Use the existing Prisma models:

- `User`
- `Role`
- `Permission`
- `ApiKey`

Required permission groups:

- `employees.view/create/update/lock/export`
- `certificates.view/create/update/review/approve/reject/delete/export`
- `reports.view/create/export/share`
- `training.view/update/recalculate`
- `admin.users/roles/settings/audit/apiKeys`
- `ai.chat/ai.query/ai.act`

Implementation rule: all API routes must check permissions server-side. UI hiding is only a convenience.

### 3. File Storage

Use `CertificateFile` as the database record and move binary files to object storage:

- Cloudflare R2 for low-cost production storage, or Supabase Storage for fastest MVP.
- Store private file keys, not public URLs.
- Return signed URLs from server APIs.
- Generate thumbnails server-side.
- Store checksum to detect duplicate uploads.

### 4. OCR Queue

Use existing models:

- `Certificate.ocrStatus`
- `CertificateOcrResult`
- `CertificateFile`

Recommended flow:

1. Upload file.
2. Create `Certificate` with `ocrStatus=QUEUED`, `reviewStatus=PROCESSING`.
3. Enqueue OCR job.
4. OCR worker extracts raw text and structured JSON.
5. Store result in `CertificateOcrResult`.
6. Update certificate fields with confidence score.
7. Route to `PENDING_CONFIRMATION` or `MISSING_INFO`.

AI enhancement:

- Extract fields with OpenAI Vision or Document AI.
- Match holder against `User` by name, department and license number.
- Detect likely duplicates by checksum, certificate code, holder/date/title similarity.
- Explain low-confidence fields to reviewer.

### 5. Audit Log

Use `AuditLog` for every critical event:

- Login/logout
- User/role/permission changes
- Certificate create/update/approve/reject/delete
- OCR result accepted/overridden
- Report generated/exported/shared
- API key created/revoked
- Settings changed
- AI action suggested/executed

Audit log should store:

- actor
- action
- entity type/id
- before/after JSON
- IP/user agent
- created time

### 6. Review Workflow

Commercial workflow:

```text
Uploaded
-> OCR queued
-> OCR processing
-> Pending confirmation
-> Pending review
-> Approved
```

Exception paths:

```text
OCR failed -> Manual entry
Missing info -> Request supplement
Rejected -> Store rejection reason
Duplicate suspected -> Reviewer resolves duplicate
Excluded from cycle -> Stored but not counted
```

### 7. Real Export

Reports should produce real Excel/PDF artifacts:

- Export employee compliance by cycle.
- Export certificate list by status/date/department.
- Export expiring certificates.
- Export missing CCHN/missing hours.
- Save generated report metadata in `Report`.
- Share through `SharedReport` token with expiry and audit log.

## Phase 1 AI Features

These are realistic for the internal commercial MVP:

1. AI certificate extraction
   - Reads image/PDF.
   - Extracts fields.
   - Highlights low-confidence values.
   - Suggests matched employee.

2. AI reviewer assistant
   - "Vì sao chứng chỉ này thiếu thông tin?"
   - "Chứng chỉ này có nên tính vào chu kỳ 2025-2026 không?"
   - "Có nghi trùng với chứng chỉ nào không?"

3. AI report assistant
   - Converts natural language into saved report filters.
   - Example: "Báo cáo khoa Dược thiếu số tiết trong chu kỳ này."
   - Must show filter preview before export.

4. AI reminder drafts
   - Drafts notification/email content.
   - Human must approve before sending.

5. AI data quality scanner
   - Finds missing CCHN, impossible dates, duplicate names, invalid hours, expired certificates still counted.
   - Produces a remediation queue.

## Phase 2: Sản Phẩm Bán Rộng

### 1. Multi-Tenant Architecture

Add tenant isolation to every core model.

Recommended new model:

```prisma
model Tenant {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  logoUrl   String?
  theme     Json?
  plan      String   @default("trial")
  status    String   @default("ACTIVE")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Add `tenantId` to:

- `User`
- `Role`
- `Department`
- `Position`
- `CertificateType`
- `TrainingCycle`
- `Certificate`
- `Report`
- `Notification`
- `Conversation`
- `ApiKey`
- `AuditLog`
- `Setting`

Rule: every query must be scoped by tenant.

### 2. Billing And Licensing

Billing does not need to be complex at first. Start with license-based plans:

- Trial
- Clinic
- Hospital
- Enterprise

Track:

- max users
- max certificates/month
- OCR pages/month
- AI messages/month
- storage GB
- retention period

Later integrate Stripe or local invoice workflow.

### 3. Realtime Notifications

Use the existing `Notification` model and add realtime delivery:

- In-app notification center.
- Email digest.
- Optional Zalo/SMS integration.
- Reviewer task queue.
- Manager escalation for overdue reviews.

Realtime options:

- Supabase Realtime for fast MVP.
- WebSocket service for full control.
- Polling fallback for constrained deployments.

### 4. OCR Worker And Job Queue

Add a job table or queue provider:

- BullMQ + Redis for standard Node deployment.
- Database-backed job table for simpler hospital/internal deployments.
- Background worker process for OCR/report generation.

Job types:

- `OCR_CERTIFICATE`
- `GENERATE_REPORT`
- `RECALCULATE_TRAINING_SUMMARY`
- `SEND_NOTIFICATION`
- `AI_DATA_QUALITY_SCAN`

### 5. AI Assistant With Permissioned Tools

The AI assistant should not receive the whole database blindly. It should call safe tools:

- `searchEmployees(filters)`
- `searchCertificates(filters)`
- `getComplianceSummary(cycleId, departmentId?)`
- `createReportDraft(filters)`
- `draftReminder(targetIds, template)`
- `explainCertificate(certificateId)`
- `scanDataQuality(scope)`

Every tool must enforce:

- tenant scope
- user permissions
- row-level constraints
- audit logging for mutating actions

Recommended AI interaction model:

```text
User question
-> classify intent
-> build safe query/filter
-> show preview
-> user confirms action
-> execute
-> audit log
```

### 6. Custom Dashboard

Dashboard should become configurable:

- Widgets by role.
- Saved filters by department/cycle.
- Drilldown from metric to list.
- Export widget data.
- AI insight cards:
  - "5 hồ sơ có nguy cơ không đạt chu kỳ."
  - "Khoa X tăng số chứng chỉ chờ duyệt."
  - "3 chứng chỉ có ngày cấp bất thường."

### 7. Theme And Branding

Tenant-level branding:

- Logo
- Primary color
- Accent color
- Report header/footer
- Public verification page branding
- Email template branding

Keep UI professional:

- Use `Be Vietnam Pro` or `Inter`.
- Reduce heavy rounded cards in dense admin screens.
- Use consistent 8-12px radius for operational UI.
- Use badges/tables/drawers for workflows, not marketing-style sections.

## Suggested Execution Order

### Sprint 1: Data Foundation

- Implement employee/certificate APIs with Prisma.
- Migrate Employees and Certificates UI away from localStorage.
- Add permission middleware helper.
- Add audit helper for create/update/delete.

### Sprint 2: Certificate Workflow

- Server upload records into `CertificateFile`.
- Create review endpoints.
- Add approval/rejection drawer.
- Recalculate `TrainingSummary` after approval.

### Sprint 3: OCR And AI Extraction

- Add OCR queue.
- Implement OpenAI Vision provider.
- Store `CertificateOcrResult`.
- Add reviewer confirmation UI with low-confidence highlights.

### Sprint 4: Reports And Export

- Persist report definitions.
- Generate Excel/PDF server-side.
- Add shared report tokens and QR.
- Audit export/share events.

### Sprint 5: AI Assistant Tools

- Replace free-form context dump with permissioned server tools.
- Add query preview.
- Add report draft and reminder draft flows.
- Add AI data quality scanner.

### Sprint 6: Multi-Tenant Base

- Add `Tenant`.
- Add `tenantId` to core models.
- Scope auth session and all queries.
- Add tenant branding settings.

### Sprint 7: Billing, Notifications, Hardening

- Add plan/license limits.
- Add notification center and delivery jobs.
- Add rate limiting, upload scanning and API key hashing.
- Add backup/retention settings.

## Commercial Definition Of Done

A feature is commercial-ready only when:

- It stores data in PostgreSQL.
- It has server-side permission checks.
- It writes audit logs for critical changes.
- It has loading, empty and error states.
- It has export/import behavior if it owns operational data.
- It works after browser refresh and across devices.
- It has no dependency on localStorage except UI preferences.
- It does not expose secrets to the client.
- It has a path for tenant isolation.
- AI behavior is explainable and confirmable before mutation.
