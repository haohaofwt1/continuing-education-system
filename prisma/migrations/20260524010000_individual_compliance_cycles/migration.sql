-- CreateEnum
CREATE TYPE "ComplianceCycleStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'OVERDUE', 'CLOSED');

-- AlterTable
ALTER TABLE "Position" ADD COLUMN "compliancePolicyId" TEXT;

-- CreateTable
CREATE TABLE "CompliancePolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "cycleYears" INTEGER NOT NULL DEFAULT 5,
    "requiredHours" DOUBLE PRECISION NOT NULL DEFAULT 120,
    "annualMinimumHours" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "requiresLicense" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompliancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeComplianceCycle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "requiredHours" DOUBLE PRECISION NOT NULL,
    "annualMinimumHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "approvedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "missingHours" DOUBLE PRECISION NOT NULL,
    "status" "ComplianceCycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeComplianceCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "employeeId" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "cycleId" TEXT,
    "creditDate" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "includedInCycle" BOOLEAN NOT NULL DEFAULT true,
    "excludeReason" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompliancePolicy_code_key" ON "CompliancePolicy"("code");

-- CreateIndex
CREATE INDEX "CompliancePolicy_tenantId_isActive_idx" ON "CompliancePolicy"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "EmployeeComplianceCycle_tenantId_status_endDate_idx" ON "EmployeeComplianceCycle"("tenantId", "status", "endDate");

-- CreateIndex
CREATE INDEX "EmployeeComplianceCycle_employeeId_startDate_endDate_idx" ON "EmployeeComplianceCycle"("employeeId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "CreditRecord_tenantId_creditDate_idx" ON "CreditRecord"("tenantId", "creditDate");

-- CreateIndex
CREATE INDEX "CreditRecord_employeeId_creditDate_idx" ON "CreditRecord"("employeeId", "creditDate");

-- CreateIndex
CREATE UNIQUE INDEX "CreditRecord_certificateId_employeeId_creditDate_key" ON "CreditRecord"("certificateId", "employeeId", "creditDate");

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_compliancePolicyId_fkey" FOREIGN KEY ("compliancePolicyId") REFERENCES "CompliancePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompliancePolicy" ADD CONSTRAINT "CompliancePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeComplianceCycle" ADD CONSTRAINT "EmployeeComplianceCycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeComplianceCycle" ADD CONSTRAINT "EmployeeComplianceCycle_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeComplianceCycle" ADD CONSTRAINT "EmployeeComplianceCycle_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "CompliancePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditRecord" ADD CONSTRAINT "CreditRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditRecord" ADD CONSTRAINT "CreditRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditRecord" ADD CONSTRAINT "CreditRecord_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditRecord" ADD CONSTRAINT "CreditRecord_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "EmployeeComplianceCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
