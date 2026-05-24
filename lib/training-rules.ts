export type TrainingCycleRule = "LICENSED_PRACTITIONER_2Y" | "GENERAL_HEALTH_WORKER_5Y";

export type TrainingCycleConfig = {
  startYear: number;
  endYear: number;
  requiredHours: number;
  rule?: TrainingCycleRule;
};

export type TrainingPlanStatus = "Đúng tiến độ" | "Cần bổ sung" | "Quá hạn";

export type TrainingPlanItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  position: string;
  department: string;
  currentHours: number;
  requiredHours: number;
  missingHours: number;
  recommendedHours: number;
  dueDate: string;
  owner: string;
  status: TrainingPlanStatus;
  reminderCadence: string;
};

export type CompliancePolicyConfig = {
  code: string;
  name: string;
  cycleYears: number;
  requiredHours: number;
  annualMinimumHours: number;
  requiresLicense: boolean;
};

export type IndividualComplianceCycle = {
  startDate: string;
  endDate: string;
  label: string;
  requiredHours: number;
  annualMinimumHours: number;
};

export const vietnamCmeRules = [
  {
    key: "LICENSED_PRACTITIONER_2Y" as const,
    label: "Người hành nghề KCB có CCHN",
    durationYears: 2,
    requiredHours: 48,
    annualMinimumHours: null,
    note: "Tối thiểu 48 tiết học trong 2 năm liên tiếp."
  },
  {
    key: "GENERAL_HEALTH_WORKER_5Y" as const,
    label: "Cán bộ y tế khác",
    durationYears: 5,
    requiredHours: 120,
    annualMinimumHours: 12,
    note: "Tối thiểu 120 tiết học trong 5 năm liên tiếp, mỗi năm tối thiểu 12 tiết."
  }
];

export function cycleStartDate(cycle: Pick<TrainingCycleConfig, "startYear">) {
  return `${cycle.startYear}-01-01`;
}

export function cycleEndDate(cycle: Pick<TrainingCycleConfig, "endYear">) {
  return `${cycle.endYear}-12-31`;
}

export function isDateInCycle(value: string | null | undefined, cycle: Pick<TrainingCycleConfig, "startYear" | "endYear">) {
  if (!value) return false;
  const time = Date.parse(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(time)) return false;
  const start = Date.parse(`${cycleStartDate(cycle)}T00:00:00`);
  const end = Date.parse(`${cycleEndDate(cycle)}T23:59:59`);
  return time >= start && time <= end;
}

export function certificateCycleAssessment(
  certificate: { issuedDate?: string | null; studyEndDate?: string | null; hours?: number | null },
  cycle: Pick<TrainingCycleConfig, "startYear" | "endYear">
) {
  const referenceDate = certificate.studyEndDate || certificate.issuedDate || null;
  const includeInCycle = isDateInCycle(referenceDate, cycle);
  return {
    referenceDate,
    includeInCycle,
    countedHours: includeInCycle ? Number(certificate.hours || 0) : 0,
    statusLabel: includeInCycle ? "Tính vào chu kỳ" : "Không tính chu kỳ",
    reason: includeInCycle
      ? `Ngày học/cấp nằm trong chu kỳ ${cycle.startYear}-${cycle.endYear}.`
      : `Ngày học/cấp không nằm trong chu kỳ ${cycle.startYear}-${cycle.endYear}; lưu minh chứng nhưng không cộng số tiết hiện tại.`
  };
}

export function nextCycle(cycle: TrainingCycleConfig) {
  const duration = Math.max(cycle.endYear - cycle.startYear + 1, 1);
  return {
    ...cycle,
    startYear: cycle.endYear + 1,
    endYear: cycle.endYear + duration
  };
}

export function buildIndividualComplianceCycle(
  anchorDate: string | null | undefined,
  policy: Pick<CompliancePolicyConfig, "cycleYears" | "requiredHours" | "annualMinimumHours">,
  referenceDate = new Date()
): IndividualComplianceCycle {
  const anchor = parseDateOnly(anchorDate) ?? new Date(referenceDate.getFullYear(), 0, 1);
  const cycleYears = Math.max(policy.cycleYears || 5, 1);
  const referenceYear = referenceDate.getFullYear();
  const elapsedYears = Math.max(referenceYear - anchor.getFullYear(), 0);
  const cycleIndex = Math.floor(elapsedYears / cycleYears);
  const startYear = anchor.getFullYear() + cycleIndex * cycleYears;
  const startDate = new Date(startYear, anchor.getMonth(), anchor.getDate());
  const endDate = new Date(startYear + cycleYears, anchor.getMonth(), anchor.getDate() - 1);

  return {
    startDate: formatDateOnly(startDate),
    endDate: formatDateOnly(endDate),
    label: `${formatDateOnly(startDate)} - ${formatDateOnly(endDate)}`,
    requiredHours: policy.requiredHours,
    annualMinimumHours: policy.annualMinimumHours
  };
}

export function cycleForCreditDate(
  anchorDate: string | null | undefined,
  creditDate: string | null | undefined,
  policy: Pick<CompliancePolicyConfig, "cycleYears" | "requiredHours" | "annualMinimumHours">
) {
  const reference = parseDateOnly(creditDate) ?? new Date();
  return buildIndividualComplianceCycle(anchorDate, policy, reference);
}

export function buildTrainingPlanItems<T extends {
  id: string;
  name: string;
  position: string;
  department: string;
  hours: number;
  requiredHours: number;
}>(records: T[], cycle: Pick<TrainingCycleConfig, "endYear">): TrainingPlanItem[] {
  return records
    .map((record) => {
      const missingHours = Math.max(record.requiredHours - record.hours, 0);
      const recommendedHours = missingHours <= 0 ? 0 : Math.max(4, Math.min(24, missingHours));
      const dueDate = `${cycle.endYear}-11-30`;
      return {
        id: `plan-${record.id}`,
        employeeId: record.id,
        employeeName: record.name,
        position: record.position,
        department: record.department,
        currentHours: record.hours,
        requiredHours: record.requiredHours,
        missingHours,
        recommendedHours,
        dueDate,
        owner: record.department || "Phòng đào tạo",
        status: missingHours === 0 ? "Đúng tiến độ" : isPastDue(dueDate) ? "Quá hạn" : "Cần bổ sung",
        reminderCadence: missingHours > 0 ? "Nhắc mỗi 30 ngày, tăng tần suất 60 ngày cuối chu kỳ" : "Không cần nhắc"
      } satisfies TrainingPlanItem;
    })
    .filter((item) => item.missingHours > 0)
    .sort((a, b) => b.missingHours - a.missingHours);
}

export function cycleDurationYears(cycle: Pick<TrainingCycleConfig, "startYear" | "endYear">) {
  return Math.max(cycle.endYear - cycle.startYear + 1, 1);
}

export function annualTargetHours(cycle: Pick<TrainingCycleConfig, "startYear" | "endYear" | "requiredHours">, annualMinimumHours = 0) {
  const average = Math.ceil(cycle.requiredHours / cycleDurationYears(cycle));
  return Math.max(average, annualMinimumHours);
}

export function expectedHoursByNow(
  cycle: Pick<TrainingCycleConfig, "startYear" | "endYear" | "requiredHours">,
  today = new Date(),
  annualMinimumHours = 0
) {
  const currentYear = Math.min(Math.max(today.getFullYear(), cycle.startYear), cycle.endYear);
  const elapsedYears = currentYear - cycle.startYear + 1;
  return Math.min(cycle.requiredHours, annualTargetHours(cycle, annualMinimumHours) * elapsedYears);
}

export function inferCycleRule(cycle: Pick<TrainingCycleConfig, "startYear" | "endYear" | "requiredHours">): TrainingCycleRule {
  if (cycle.endYear - cycle.startYear + 1 >= 5 || cycle.requiredHours >= 120) return "GENERAL_HEALTH_WORKER_5Y";
  return "LICENSED_PRACTITIONER_2Y";
}

function isPastDue(date: string) {
  const due = Date.parse(`${date}T23:59:59`);
  return !Number.isNaN(due) && Date.now() > due;
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}
