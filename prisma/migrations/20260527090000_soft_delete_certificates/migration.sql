ALTER TABLE "Certificate" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Certificate_tenantId_deletedAt_idx" ON "Certificate"("tenantId", "deletedAt");
