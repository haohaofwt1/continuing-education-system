# Vercel Deployment Guide

## Recommended Stack

- Hosting: Vercel
- PostgreSQL: Neon Postgres from Vercel Marketplace
- File storage: Vercel Blob for MVP, or Cloudflare R2/S3 for larger production storage
- AI: OpenAI API
- Realtime later: Supabase Realtime, WebSocket service or queue-backed notification worker

## Required Environment Variables

Set these in Vercel Project Settings:

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="secure-random-production-secret"
AUTH_TRUST_HOST=true
NEXT_PUBLIC_APP_URL="https://your-domain.com"
APP_ENV="production"
NEXT_PUBLIC_DEMO_FALLBACK=false

STORAGE_PROVIDER="vercel_blob"
BLOB_READ_WRITE_TOKEN="..."

OCR_PROVIDER="openai_vision"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-5-mini"

REALTIME_PROVIDER="polling"
MAX_UPLOAD_MB=20
SUPER_ADMIN_EMAIL="admin@example.com"
SUPER_ADMIN_PASSWORD="change-this-before-seed"
```

## Deploy Steps

1. Push repository to GitHub.
2. Import the repository into Vercel.
3. Add Neon Postgres from Vercel Marketplace.
4. Confirm Vercel has `DATABASE_URL`.
5. Add the remaining environment variables.
6. Run Prisma migration against production database:

```bash
npx prisma migrate deploy
```

7. Seed only if this is a first install:

```bash
npx tsx prisma/seed.ts
```

8. Open `/api/health`.
9. Open `/admin/health`.
10. Launch only when readiness checks have no failed items.

## Notes

- Do not use `prisma migrate dev` in production.
- Do not leave `AUTH_SECRET` as the example value.
- Do not sell OCR/AI as production-ready while `OCR_PROVIDER=mock`.
- Do not use `STORAGE_PROVIDER=local` for customer files.
