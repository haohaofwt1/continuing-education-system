"use client";

import { useEffect, useState } from "react";
import type React from "react";
import { AlertCircle, Check, ImageUp, Loader2, Save, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { readApiError } from "@/lib/api-client";
import type { PortalOverview } from "@/components/portal/portal-types";

export function PortalProfileClient() {
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "error">("success");
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch("/api/portal/overview", { cache: "no-store", signal: controller.signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.data) {
        setOverview(null);
        setLoadError(response.status === 401 ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." : "Không tải được hồ sơ cá nhân từ database.");
        return;
      }
      setOverview(payload.data);
      setAvatarUrl(payload.data.employee.avatarUrl ?? "");
    } catch {
      setOverview(null);
      setLoadError("Không kết nối được API hồ sơ cá nhân. Vui lòng tải lại trang.");
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setNoticeTone("success");
    const form = new FormData(event.currentTarget);
    const licenseNumber = String(form.get("licenseNumber") ?? "").trim();
    const licenseIssuedAt = String(form.get("licenseIssuedAt") ?? "").trim();
    if (!licenseNumber || !licenseIssuedAt) {
      setSaving(false);
      setNoticeTone("error");
      setNotice("Vui lòng nhập số CCHN/GPLH và ngày cấp CCHN/GPLH để hệ thống tính chu kỳ 5 năm.");
      return;
    }
    const response = await fetch("/api/portal/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? ""),
        phone: String(form.get("phone") ?? ""),
        licenseNumber,
        licenseIssuedAt,
        avatarUrl,
        notes: String(form.get("notes") ?? "")
      })
    });
    setSaving(false);
    if (!response.ok) {
      setNoticeTone("error");
      setNotice("Chưa lưu được thông tin cá nhân.");
      return;
    }
    setNoticeTone("success");
    setNotice("Đã cập nhật thông tin cá nhân.");
    await load();
  };

  const uploadAvatar = async (file: File | null) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setNoticeTone("error");
      setNotice("Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNoticeTone("error");
      setNotice("Ảnh đại diện không được vượt quá 5MB.");
      return;
    }
    setAvatarUploading(true);
    setNotice("");
    setNoticeTone("success");
    try {
      const formData = new FormData();
      formData.append("files", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const payload = await response.clone().json().catch(() => null) as { files?: Array<{ url?: string; thumbnailUrl?: string }> } | null;
      if (!response.ok) throw new Error(await readApiError(response, "UPLOAD_FAILED"));
      const uploaded = payload?.files?.[0] as { url?: string; thumbnailUrl?: string } | undefined;
      setAvatarUrl(uploaded?.thumbnailUrl || uploaded?.url || "");
      setNoticeTone("success");
      setNotice("Đã tải ảnh lên. Bấm Lưu thay đổi để cập nhật hồ sơ.");
    } catch (error) {
      setNoticeTone("error");
      setNotice(error instanceof Error ? error.message : "Chưa upload được ảnh đại diện.");
    } finally {
      setAvatarUploading(false);
    }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-700" /></div>;
  if (!overview) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
        {loadError || "Không tải được hồ sơ cá nhân."}
        <Button className="mt-4" variant="secondary" onClick={() => void load()}>Thử lại</Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Portal cá nhân"
        title="Thông tin cá nhân"
        description="Cập nhật thông tin liên hệ và thông tin CCHN dùng để tính chu kỳ CPD cá nhân."
      />
      {!overview.employee.licenseIssuedAt ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-bold">Chưa có ngày cấp CCHN/GPLH</div>
            <div className="mt-1 leading-6">Đây là mốc bắt đầu chu kỳ CPD 5 năm. Khi thiếu ngày này, hệ thống chưa cộng tín chỉ tự động cho chứng chỉ mới.</div>
          </div>
        </div>
      ) : null}
      {notice ? (
        <div className={`mb-4 rounded-2xl p-4 text-sm font-semibold ${noticeTone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {notice}
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="rounded-[24px] border-[#D7ECE8] bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[24px] bg-teal-50 text-teal-700 ring-1 ring-[#D7ECE8]">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : <UserRound className="h-10 w-10" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xl font-bold text-slate-950">{overview.employee.name}</div>
                <div className="mt-1 text-sm text-slate-500">{overview.employee.email}</div>
                <div className="mt-1 text-sm text-slate-500">{overview.employee.department} · {overview.employee.position}</div>
                <label className="mt-4 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D7ECE8] bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-teal-50">
                  {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                  Upload ảnh đại diện
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void uploadAvatar(event.target.files?.[0] ?? null)} />
                </label>
                <p className="mt-2 text-xs leading-5 text-slate-500">Ảnh sẽ được lưu sau khi bấm “Lưu thay đổi”.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-[#D7ECE8] bg-white shadow-sm">
          <CardHeader><CardTitle>Chỉnh sửa thông tin</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
              <Field label="Họ và tên"><Input name="name" defaultValue={overview.employee.name} required /></Field>
              <Field label="Email"><Input defaultValue={overview.employee.email} disabled /></Field>
              <Field label="Điện thoại"><Input name="phone" defaultValue={overview.employee.phone ?? ""} /></Field>
              <Field label="Số CCHN/GPLH"><Input name="licenseNumber" defaultValue={overview.employee.licenseNumber} required /></Field>
              <Field label="Ngày cấp CCHN/GPLH"><Input name="licenseIssuedAt" type="date" defaultValue={overview.employee.licenseIssuedAt} required /></Field>
              <Field label="Khoa/Phòng"><Input defaultValue={overview.employee.department} disabled /></Field>
              <Field label="Chức danh"><Input defaultValue={overview.employee.position} disabled /></Field>
              <label className="md:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ghi chú cập nhật</span>
                <textarea name="notes" className="min-h-24 w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Ghi chú nếu cần quản trị viên kiểm tra..." />
              </label>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Lưu thay đổi</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardContent className="flex items-start gap-3 p-5 text-sm text-slate-600">
          <Check className="mt-0.5 h-5 w-5 text-emerald-600" />
          Khoa/Phòng, chức danh và vai trò do quản trị viên quản lý để tránh nhân viên tự thay đổi điều kiện tuân thủ.
        </CardContent>
      </Card>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;
}
