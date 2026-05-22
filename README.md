# Hệ thống Đào tạo Liên tục

MVP web app quản lý nhân sự, chứng chỉ, CCHN, số tiết đào tạo liên tục, báo cáo và xác minh công khai.

## Chạy local

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Mặc định một số UI vẫn có fallback demo để có thể mở nhanh trước khi cấu hình PostgreSQL. Các phần đang được chuyển dần sang database/API thật; xem [Commercial Readiness](./docs/COMMERCIAL_READINESS.md), [Commercial Standardization](./docs/COMMERCIAL_STANDARDIZATION.md), [AI-Native Commercialization Plan](./docs/AI_NATIVE_COMMERCIALIZATION_PLAN.md) và [Vercel Deployment Guide](./docs/VERCEL_DEPLOYMENT.md).

## Chạy bằng PostgreSQL thật

Ứng dụng thương mại cần PostgreSQL chạy đúng `DATABASE_URL` trong `.env`.

```bash
npm run db:check
npm run db:setup
npm run dev
```

Nếu `npm run db:check` báo không kết nối được `localhost:5432`, hãy cài/chạy PostgreSQL trước. Docker Compose script `npm run db:up` chỉ dùng được khi máy đã cài Docker.

## Tài khoản seed

- Email: `admin@example.com`
- Password: `ChangeMe123!`

## Kiến trúc

- `app/`: Next.js App Router, route chính và API.
- `components/`: layout, dashboard, nhân sự, chứng chỉ, upload, report, admin, ui.
- `lib/`: service boundary cho auth, permission, Prisma, OCR, AI, upload, report, audit.
- `prisma/`: schema và seed data.

OCR/AI hiện là adapter mock, có thể thay bằng Google Vision, Document AI hoặc OpenAI Vision qua `lib/ocr.ts` mà không đổi UI.

## Discuss thương mại

Module Discuss đã có schema/API database thật:

- `Conversation`
- `ConversationMember`
- `Message`
- `MessageAttachment`
- `MessageReadReceipt`

UI sẽ gọi `/api/discuss/threads` và `/api/discuss/messages` trước. Nếu PostgreSQL chưa migrate hoặc chưa chạy, UI mới fallback demo.
