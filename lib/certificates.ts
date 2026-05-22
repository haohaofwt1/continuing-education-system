import { certificates } from "@/lib/mock-data";

export type CertificateFilters = {
  q?: string;
  department?: string;
  status?: string;
  type?: string;
};

export function listCertificates(filters: CertificateFilters = {}) {
  return certificates.filter((certificate) => {
    const q = filters.q?.toLowerCase();
    return (
      (!q || `${certificate.title} ${certificate.holder} ${certificate.code}`.toLowerCase().includes(q)) &&
      (!filters.department || certificate.department === filters.department) &&
      (!filters.status || certificate.status === filters.status) &&
      (!filters.type || certificate.type === filters.type)
    );
  });
}
