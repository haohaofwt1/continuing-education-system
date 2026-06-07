DROP INDEX IF EXISTS "Certificate_certificateCode_key";

CREATE UNIQUE INDEX "Certificate_tenantId_certificateCode_key" ON "Certificate"("tenantId", "certificateCode");
