# Market And Commercialization Gap

## Summary

The product is closest to a healthcare continuing education, certificate, compliance and workforce-readiness platform. Large comparable systems do not sell only certificate storage. They sell audit-ready operations: role-based learning requirements, credential tracking, compliance evidence, approval workflows, automated reminders, reporting, integrations, security and tenant isolation.

Current codebase status: the product has a strong MVP direction and schema, but is not commercially launch-ready because several screens still depend on demo/localStorage fallback, file/OCR flows are mock or local-first, reporting/export is not yet a real artifact pipeline, and tenant/billing/customer operations are not implemented.

## Comparable Systems

### HealthStream

Positioning: healthcare workforce management platform covering learning, clinical development, credentialing, scheduling, quality/compliance, revenue cycle and resuscitation.

Commercial signals:

- Unified workforce suite, not only LMS.
- Credentialing and primary source verification are treated as core healthcare workflows.
- Security certification is part of sales trust, including HITRUST positioning.
- SaaS/subscription pricing is based on subscriptions and selected solutions.

Source: https://www.healthstream.com/solution

### Relias

Positioning: healthcare LMS and compliance platform focused on mandatory training, role/team assignment, audit support and reporting.

Commercial signals:

- Role-based and team-based assignment.
- Annual learning plans and new-hire automation.
- Compliance tracking dashboards and audit/survey reports.
- Content library is a major differentiator.

Source: https://www.relias.com/product/learning-management-system/tracking-and-reporting

### MedTrainer

Positioning: healthcare compliance, credentialing and learning on one platform.

Commercial signals:

- Single interface for learning, credentialing and compliance.
- Onboarding workflows, HRIS integration, document requests and audit readiness.
- AI is positioned as workflow assistance, not just chat.
- Strong industry packaging: "learning + compliance + credentialing".

Sources:

- https://medtrainer.com/products/learning/
- https://medtrainer.com/

### Docebo

Positioning: enterprise LMS/LXP with AI, automation, extended enterprise, certifications, compliance dashboards and integrations.

Commercial signals:

- Automated enrollment, tracking, certifications, renewal notifications and dashboards.
- AI authoring and AI agents are tied to permissions, integrations and audit trails.
- Supports multiple audiences such as employees, customers and partners.
- Enterprise trust depends on SSO, integrations, data privacy and security standards.

Sources:

- https://www.docebo.com/solutions/compliance-training/
- https://www.docebo.com/

## What These Systems Have That This Product Must Add

### 1. Commercial Data Foundation

Required before selling:

- Disable production demo fallback: `NEXT_PUBLIC_DEMO_FALLBACK=false`.
- Replace all localStorage/demo paths with Prisma-backed APIs.
- Make PostgreSQL the only source of truth.
- Add seed/import tooling for real customer onboarding.
- Add migration discipline and backup/restore process.

Current gaps found in code:

- `components/training/training-client.tsx` still stores cycle/settings in localStorage.
- `components/reports/reports-client.tsx` still creates mock reports.
- `components/admin/admin-management-clients.tsx` still stores accounts/categories/API keys/QR in localStorage.
- Dashboard/topbar/sidebar still read demo store for counts and status.
- `app/employees/[id]/page.tsx` and certificate verification still import mock data.

### 2. Healthcare Compliance Workflow

Commercial buyers need a workflow they can defend during inspection or accreditation.

Add:

- Certificate lifecycle: upload -> OCR queued -> pending confirmation -> pending review -> approved/rejected/missing info/duplicate/excluded.
- Reviewer task queue with due dates and assignment.
- Evidence history for every certificate.
- Training cycle recalculation from approved certificates only.
- Policy for locked users and archived data instead of destructive deletes.
- Manager escalation when staff are missing required hours or license documents.

### 3. Production File And OCR Pipeline

Large systems avoid browser/local file assumptions.

Add:

- Object storage: Cloudflare R2, S3, Supabase Storage or Vercel Blob.
- Private file keys and signed URLs.
- File validation, antivirus or at least MIME/size/checksum validation.
- Server-generated thumbnails.
- Async OCR job queue.
- OCR provider adapter: OpenAI Vision, Google Document AI or Google Vision.
- Store raw OCR text, structured JSON, confidence and reviewer overrides.

### 4. Reports That Are Audit-Ready

Reports must be reproducible, exportable and shareable.

Add:

- Saved report definitions with filters, creator, generated time and source scope.
- Excel/PDF export jobs.
- Public/shared report tokens with expiry.
- QR verification pages backed by database.
- Audit logs for every export/share.
- Standard compliance reports: missing hours, expiring certificates, expired CCHN, department compliance, cycle summary, reviewer backlog.

### 5. Security And Permission Hardening

This is non-negotiable for commercialization.

Add:

- Server-side permission checks on every API route.
- Tenant-scoped queries before selling to more than one organization.
- Hashed API keys only; never store raw keys.
- Audit log with before/after JSON for sensitive changes.
- Rate limits for auth, upload, API keys and AI endpoints.
- Production secret validation.
- SSO/SAML/OIDC roadmap for hospitals and enterprise customers.

### 6. Multi-Tenant And Billing

Selling commercially requires product operations, not just app features.

Add:

- `Tenant` model.
- `tenantId` on users, departments, positions, certificates, cycles, reports, settings, audit logs, notifications, conversations and API keys.
- Tenant admin settings: logo, plan, limits, retention, OCR quota, storage quota.
- Subscription or license plans: Trial, Clinic, Hospital, Enterprise.
- Usage counters: active users, certificates/month, OCR pages/month, AI messages/month, storage.
- Customer lifecycle: trial, active, suspended, cancelled.

### 7. Integrations

Enterprise buyers expect integration points.

Add:

- Employee import/export via Excel.
- HRIS integration hooks or at least scheduled CSV import.
- Email notifications first; Zalo/SMS later if targeting Vietnam healthcare.
- Webhook/API for certificate verification and report sharing.
- BI export or simple analytics API.
- Optional SSO for larger hospitals.

### 8. AI As A Controlled Workflow Layer

AI can differentiate the product, but only if permissioned and auditable.

Add:

- AI certificate extraction with field-level confidence.
- AI duplicate detection.
- AI compliance gap scanner.
- AI report draft from natural language, with filter preview before export.
- AI reminder drafts requiring human confirmation.
- AI tool calls scoped by tenant and permission.
- Audit log for AI suggestion, accepted action and rejected action.

## Recommended Commercial Roadmap

### Phase 0: Launch Gate

Goal: make the current product safe enough for paid pilots.

- PostgreSQL-only production mode.
- Remove demo/localStorage from customer-facing flows.
- Real auth, role and permission checks.
- Real object storage with signed URLs.
- Real report save/export for Excel at minimum.
- Health page must show no failed checks.
- Basic audit logs on users, certificates, reports and settings.

### Phase 1: Paid Pilot

Goal: sell to 1-3 organizations with high-touch onboarding.

- Certificate review workflow.
- Training cycle recalculation.
- Reviewer queue and notifications.
- Excel import/export.
- OCR queue with one real provider.
- Standard dashboard and compliance reports.
- Admin settings for departments, positions, required hours and certificate types.

### Phase 2: Sellable SaaS

Goal: support multiple customers without custom deployments per customer.

- Multi-tenant isolation.
- Billing/plan limits.
- Customer admin onboarding.
- Tenant branding.
- Usage metering.
- Support tooling: impersonation with audit, error logs, customer health status.
- Email notification templates.

### Phase 3: Enterprise Healthcare Platform

Goal: compete with larger healthcare workforce/compliance systems in a focused market.

- SSO/SAML/OIDC.
- Advanced credentialing: license verification, primary source verification workflow, provider profile.
- Policy/compliance module.
- Incident/task module if required by buyer segment.
- BI connectors.
- AI agents with scheduled compliance scans and audited actions.

## Product Positioning Recommendation

Do not position this as a generic LMS. The strongest wedge is:

"Hệ thống quản lý đào tạo liên tục, chứng chỉ hành nghề và bằng chứng tuân thủ cho cơ sở y tế tại Việt Nam."

This is narrower than Docebo and HealthStream, but commercially stronger for local buyers because it maps directly to Vietnamese healthcare compliance workflows, certificate evidence and inspection readiness.

## Minimum Paid Pilot Checklist

- Database-only mode works with demo fallback disabled.
- User roles and permissions are enforced on the server.
- Certificates upload to private object storage.
- OCR runs asynchronously and stores reviewable results.
- Review/approve/reject workflow is complete.
- Training hours are recalculated from approved data.
- Reports export to real Excel/PDF files.
- Every critical action writes audit logs.
- Admin can configure departments, positions, certificate types and cycles.
- Health check clearly says ready/not ready.
- Backup/restore and customer data deletion process are documented.

