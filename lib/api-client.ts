import type { DemoEmployee, DemoCertificate } from "@/lib/demo-store";

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
  if (!response.ok) throw new Error("CERTIFICATE_API_SAVE_FAILED");
  const payload = (await response.json()) as { data: DemoCertificate };
  return payload.data;
}

export async function deleteCertificateFromApi(id: string) {
  const response = await fetch(`/api/certificates/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("CERTIFICATE_API_DELETE_FAILED");
}
