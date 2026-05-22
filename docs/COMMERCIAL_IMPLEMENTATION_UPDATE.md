# Commercial Implementation Update

This update turns the earlier commercialization checklist into concrete backend foundations.

## Implemented

- Production auth guard: unauthenticated demo pass-through is disabled when `NEXT_PUBLIC_DEMO_FALLBACK=false`.
- Server-side permission checks and simple rate limits on upload, OCR, certificate review, reports and AI endpoints.
- Multi-tenant schema foundation with plan, status, limits and monthly usage records.
- Certificate review workflow endpoint: `POST /api/certificates/:id/review`.
- Certificate review history table: `CertificateReviewEvent`.
- Async OCR queue table: `OcrJob`.
- OCR API can enqueue by `certificateId` and process immediately for small deployments.
- File metadata now stores `storageKey` and SHA-256 checksum.
- Object storage readiness is enforced for production.
- Reports now save definitions in `Report`, create export artifacts in `ReportArtifact`, and can create share tokens in `SharedReport`.
- AI requests now require `ai.chat` and write `AiActionLog` plus audit logs.
- Readiness checks now include tenant foundation and commercial tables.

## Still Required Before Selling Broadly

- Replace remaining customer-facing localStorage UI modules with database APIs.
- Connect a real storage SDK for the selected provider: R2, S3, Supabase Storage or Vercel Blob.
- Run OCR jobs in a real background worker instead of request-time `processNow`.
- Add real OpenAI Vision / Google Document AI provider implementation.
- Add PDF rendering with a production renderer if official-looking PDFs are required.
- Add tenant-aware unique constraints once data migration strategy is fixed.
- Add billing UI and quota enforcement in business flows.
- Add SSO/SAML/OIDC for enterprise hospitals.

## Migration

The schema migration is in:

`prisma/migrations/20260522000000_commercial_foundation/migration.sql`

Local PostgreSQL was not reachable during this update, so run this after starting the database:

```bash
npm run db:check
npm run prisma:migrate
npm run prisma:seed
```

