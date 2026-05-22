export const permissions = {
  viewPersonnel: "personnel.view",
  managePersonnel: "personnel.manage",
  viewCertificates: "certificates.view",
  createCertificate: "certificates.create",
  approveCertificate: "certificates.approve",
  rejectCertificate: "certificates.reject",
  deleteCertificate: "certificates.delete",
  exportReports: "reports.export",
  viewUnitReports: "reports.unit",
  viewDepartmentReports: "reports.department",
  createReports: "reports.create",
  shareReports: "reports.share",
  manageCatalog: "catalog.manage",
  manageApiKeys: "api_keys.manage",
  manageSettings: "settings.manage",
  aiChat: "ai.chat",
  aiAct: "ai.act"
} as const;

export type PermissionKey = (typeof permissions)[keyof typeof permissions];

export function can(userPermissions: string[], permission: PermissionKey) {
  return userPermissions.includes(permission);
}

export function assertPermission(userPermissions: string[], permission: PermissionKey) {
  if (!can(userPermissions, permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
}
