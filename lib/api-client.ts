import type { DemoEmployee, DemoCertificate } from "@/lib/demo-store";

type ApiErrorPayload = {
  error?: string;
  detail?: string;
  message?: string;
};

export async function readApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  return payload?.detail || payload?.message || payload?.error || fallback;
}

export async function saveEmployeeToApi(employee: DemoEmployee, exists: boolean) {
  const response = await fetch(exists ? `/api/employees/${employee.id}` : "/api/employees", {
    method: exists ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(employee)
  });
  if (!response.ok) throw new Error("EMPLOYEE_API_SAVE_FAILED");
  const payload = (await response.json()) as { data: DemoEmployee };
  return payload.data;
}

export async function deleteEmployeeFromApi(id: string) {
  const response = await fetch(`/api/employees/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("EMPLOYEE_API_DELETE_FAILED");
}

export async function saveCertificateToApi(certificate: DemoCertificate, exists: boolean) {
  const response = await fetch(exists ? `/api/certificates/${certificate.id}` : "/api/certificates", {
    method: exists ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(certificate)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; detail?: string } | null;
    throw new Error(payload?.detail || payload?.error || "CERTIFICATE_API_SAVE_FAILED");
  }
  const payload = (await response.json()) as { data: DemoCertificate };
  return payload.data;
}

export async function deleteCertificateFromApi(id: string) {
  const response = await fetch(`/api/certificates/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string; detail?: string } | null;
    throw new Error(payload?.detail || payload?.error || "CERTIFICATE_API_DELETE_FAILED");
  }
}
