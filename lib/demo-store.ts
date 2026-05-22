"use client";

import { certificates as seedCertificates, employees as seedEmployees } from "@/lib/mock-data";

export type DemoEmployee = (typeof seedEmployees)[number] & {
  avatarUrl?: string;
};
export type DemoCertificate = (typeof seedCertificates)[number] & {
  fileUrl?: string | null;
  fileName?: string | null;
  fileMimeType?: string | null;
  fileSizeBytes?: number | null;
  rawText?: string;
  certificateNumber?: string | null;
  holderBirthDate?: string | null;
  holderAddress?: string | null;
  studyStartDate?: string | null;
  studyEndDate?: string | null;
  equivalentCredits?: number | null;
  responsibleUnit?: string | null;
  learningFormat?: string | null;
  courseContent?: string;
  verificationNumber?: string | null;
  issuePlace?: string | null;
};

const employeeKey = "cme.demo.employees";
const certificateKey = "cme.demo.certificates";
const settingsKey = "cme.demo.settings";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getEmployees() {
  return readJson<DemoEmployee[]>(employeeKey, seedEmployees);
}

export function saveEmployees(items: DemoEmployee[]) {
  writeJson(employeeKey, items);
}

export function getCertificates() {
  return readJson<DemoCertificate[]>(certificateKey, seedCertificates);
}

export function saveCertificates(items: DemoCertificate[]) {
  writeJson(certificateKey, items);
}

export function getSettings() {
  return readJson(settingsKey, {
    appName: "Hệ thống Đào tạo Liên tục",
    requiredHours: 48,
    cycleStartYear: 2025,
    cycleEndYear: 2026,
    ocrProvider: "mock",
    storageProvider: "local"
  });
}

export function saveSettings(settings: ReturnType<typeof getSettings>) {
  writeJson(settingsKey, settings);
}

export function downloadCsv(fileName: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function resetDemoData() {
  saveEmployees(seedEmployees);
  saveCertificates(seedCertificates);
  window.localStorage.removeItem(settingsKey);
}
