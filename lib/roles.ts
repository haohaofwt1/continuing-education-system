export function isEmployeeRole(role?: string | null) {
  return ["Nhan vien", "Nhân viên", "Employee", "EMPLOYEE"].includes(role ?? "");
}
