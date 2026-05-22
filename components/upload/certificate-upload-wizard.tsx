"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Camera, CheckCircle2, FileUp, Loader2, RotateCcw, RotateCw, ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DemoCertificate } from "@/lib/demo-store";

type Step = 1 | 2 | 3;
type UploadedFile = {
  fileName: string;
  url: string;
  thumbnailUrl?: string;
  sizeBytes: number;
  mimeType: string;
};

const fallbackExtracted = {
  certificateNumber: "",
  certificateTitle: "",
  holderName: "",
  holderBirthDate: "",
  holderAddress: "",
  issuedDate: "",
  expiredDate: "",
  studyStartDate: "",
  studyEndDate: "",
  creditHours: 0,
  equivalentCredits: 0,
  issuingOrganization: "",
  responsibleUnit: "",
  certificateType: "Cập nhật kiến thức y khoa liên tục",
  learningFormat: "",
  courseContent: "",
  verificationNumber: "",
  issuePlace: "",
  confidence: 0.1
};

export function CertificateUploadWizard({ onCreate }: { onCreate?: (certificate: DemoCertificate) => void }) {
  const [step, setStep] = useState<Step>(1);
  const [processing, setProcessing] = useState(false);
  const [extracted, setExtracted] = useState(fallbackExtracted);
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState("/placeholder-certificate.svg");
  const [rotation, setRotation] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setStep(2);
    setProcessing(true);
    const first = acceptedFiles[0];
    setUploadedFile(null);
    setPreview("/placeholder-certificate.svg");
    setRotation(0);
    void (async () => {
      let storedFile: UploadedFile | null = null;
      try {
        if (first) {
          if (first.type !== "application/pdf") {
            setPreview(await fileToDataUrl(first));
          }
          const formData = new FormData();
          formData.append("files", first);
          const uploadResponse = await fetch("/api/upload", { method: "POST", body: formData });
          const uploadData = await uploadResponse.json();
          storedFile = uploadResponse.ok ? uploadData.files?.[0] ?? null : null;
          setUploadedFile(storedFile);
          if (storedFile?.thumbnailUrl) setPreview(storedFile.thumbnailUrl);
        }

        const autoRotation = first?.name?.toLowerCase().includes("dthuong") ? 90 : 0;
        if (autoRotation) setRotation(autoRotation);

        const ocrResponse = await fetch("/api/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: first?.name ?? "", fileUrl: storedFile?.url ?? null, rotation: autoRotation })
        });
        const data = await ocrResponse.json();
        if (data.extracted) setExtracted(data.extracted);
        if (data.rawText) setRawText(data.rawText);
      } catch {
        setRawText("OCR/upload mock không phản hồi, dùng dữ liệu mẫu.");
      } finally {
        setProcessing(false);
        setStep(3);
      }
    })();
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "application/pdf": [".pdf"]
    },
    maxSize: 20 * 1024 * 1024
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thêm chứng chỉ mới</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid gap-2 sm:grid-cols-3">
          {["Upload", "AI/OCR đọc dữ liệu", "Xác nhận"].map((label, index) => (
            <div key={label} className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${step >= index + 1 ? "bg-teal-600 text-white" : "bg-white text-slate-500"}`}>
              Bước {index + 1}: {label}
            </div>
          ))}
        </div>

        {step === 1 ? (
          <div
            {...getRootProps()}
            className={`flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${isDragActive ? "border-teal-600 bg-teal-50" : "border-teal-200 bg-white"}`}
          >
            <input {...getInputProps()} />
            <FileUp className="h-12 w-12 text-teal-600" />
            <div className="mt-4 text-lg font-semibold text-slate-950">Kéo thả ảnh/PDF chứng chỉ vào đây</div>
            <p className="mt-2 max-w-md text-sm text-slate-500">Hỗ trợ JPG, PNG, WEBP, PDF. Tối đa 20MB. Có thể upload nhiều file cùng lúc.</p>
            <div className="mt-5 flex gap-2">
              <Button type="button">Chọn từ tệp</Button>
              <Button type="button" variant="secondary"><Camera className="h-4 w-4" />Chụp ảnh</Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <CertificatePreview preview={preview} rotation={rotation} onRotateLeft={() => setRotation((value) => value - 90)} onRotateRight={() => setRotation((value) => value + 90)} />
            <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border bg-teal-50 p-8 text-center">
              {processing ? <Loader2 className="h-10 w-10 animate-spin text-teal-700" /> : <ScanText className="h-10 w-10 text-teal-700" />}
              <div className="mt-4 text-lg font-semibold">Đang đọc nội dung chứng chỉ...</div>
              <p className="mt-2 text-sm text-slate-500">Demo hiện dùng OCR mock. File mẫu ntbngoc_09042026.jpeg và dthuong_20042026.jpeg sẽ được bóc tách theo template; ảnh khác cần nối OCR thật.</p>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <CertificatePreview preview={preview} rotation={rotation} onRotateLeft={() => setRotation((value) => value - 90)} onRotateRight={() => setRotation((value) => value + 90)} />
              <div className="mt-3 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                Confidence score: {Math.round(extracted.confidence * 100)}%
              </div>
              <div className="mt-3 rounded-2xl border bg-white p-3 text-xs leading-5 text-slate-600">
                File đang lưu: <span className="font-semibold text-slate-900">{uploadedFile?.url ?? "Chưa có file lưu trên server"}</span>
              </div>
              <details className="mt-3 rounded-2xl border p-3 text-sm text-slate-600">
                <summary className="cursor-pointer font-semibold">Raw text OCR</summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs">{rawText || "Chưa có raw text."}</pre>
              </details>
            </div>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const certificate: DemoCertificate = {
                  id: `c${Date.now()}`,
                  code: String(formData.get("certificateNumber") ?? "") || `CERT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`,
                  title: String(formData.get("title") ?? ""),
                  holder: String(formData.get("holder") ?? ""),
                  department: "Phòng khám",
                  position: "Bác sĩ",
                  type: String(formData.get("type") ?? ""),
                  issuer: String(formData.get("issuer") ?? ""),
                  issuedDate: String(formData.get("issuedDate") ?? ""),
                  expiredDate: String(formData.get("expiredDate") ?? "") || null,
                  hours: Number(formData.get("hours") ?? 0),
                  status: String(formData.get("action")) === "approve" ? "Đã duyệt" : "Chờ duyệt",
                  tone: String(formData.get("action")) === "approve" ? "green" : "yellow",
                  ocrStatus: "Đã đọc",
                  confidence: extracted.confidence,
                  thumbnail: uploadedFile?.thumbnailUrl || uploadedFile?.url || preview,
                  fileUrl: uploadedFile?.url ?? null,
                  fileName: uploadedFile?.fileName ?? null,
                  fileMimeType: uploadedFile?.mimeType ?? null,
                  fileSizeBytes: uploadedFile?.sizeBytes ?? null,
                  rawText,
                  certificateNumber: String(formData.get("certificateNumber") ?? ""),
                  holderBirthDate: String(formData.get("holderBirthDate") ?? ""),
                  holderAddress: String(formData.get("holderAddress") ?? ""),
                  studyStartDate: String(formData.get("studyStartDate") ?? ""),
                  studyEndDate: String(formData.get("studyEndDate") ?? ""),
                  equivalentCredits: Number(formData.get("equivalentCredits") ?? 0),
                  responsibleUnit: String(formData.get("responsibleUnit") ?? ""),
                  learningFormat: String(formData.get("learningFormat") ?? ""),
                  courseContent: String(formData.get("courseContent") ?? ""),
                  verificationNumber: String(formData.get("verificationNumber") ?? ""),
                  issuePlace: String(formData.get("issuePlace") ?? "")
                };
                onCreate?.(certificate);
                setPreview("/placeholder-certificate.svg");
                setRotation(0);
                setUploadedFile(null);
                setStep(1);
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Số giấy chứng nhận / mã chứng chỉ">
                  <Input name="certificateNumber" defaultValue={extracted.certificateNumber ?? ""} />
                </Field>
                <Field label="Loại chứng chỉ">
                  <Input name="type" defaultValue={extracted.certificateType} />
                </Field>
                <Field className="sm:col-span-2" label="Tên giấy chứng nhận / tiêu đề">
                  <Input name="title" defaultValue={extracted.certificateTitle} />
                </Field>
              </div>

              <div className="rounded-2xl border bg-teal-50/40 p-4">
                <div className="mb-3 text-sm font-semibold text-teal-900">Thông tin người được cấp</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Họ tên">
                    <Input name="holder" defaultValue={extracted.holderName} />
                  </Field>
                  <Field label="Ngày sinh">
                    <Input name="holderBirthDate" defaultValue={extracted.holderBirthDate ?? ""} />
                  </Field>
                  <Field className="sm:col-span-2" label="Địa chỉ / Đơn vị">
                    <Input name="holderAddress" defaultValue={extracted.holderAddress ?? ""} />
                  </Field>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm font-semibold text-slate-900">Nội dung đào tạo</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Hình thức">
                    <Input name="learningFormat" defaultValue={extracted.learningFormat ?? ""} />
                  </Field>
                  <Field label="Đơn vị chịu trách nhiệm">
                    <Input name="responsibleUnit" defaultValue={extracted.responsibleUnit ?? ""} />
                  </Field>
                  <Field className="sm:col-span-2" label="Nội dung khóa học">
                    <textarea name="courseContent" className="min-h-24 w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-ring" defaultValue={extracted.courseContent} />
                  </Field>
                  <Field label="Từ ngày">
                    <Input name="studyStartDate" defaultValue={extracted.studyStartDate ?? ""} />
                  </Field>
                  <Field label="Đến ngày">
                    <Input name="studyEndDate" defaultValue={extracted.studyEndDate ?? ""} />
                  </Field>
                  <Field label="Số tiết">
                    <Input name="hours" defaultValue={String(extracted.creditHours)} type="number" />
                  </Field>
                  <Field label="Quy đổi giờ tín chỉ">
                    <Input name="equivalentCredits" defaultValue={String(extracted.equivalentCredits ?? "")} type="number" />
                  </Field>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4">
                <div className="mb-3 text-sm font-semibold text-slate-900">Cấp/chứng thực</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Đơn vị cấp">
                    <Input name="issuer" defaultValue={extracted.issuingOrganization} />
                  </Field>
                  <Field label="Nơi cấp">
                    <Input name="issuePlace" defaultValue={extracted.issuePlace ?? ""} />
                  </Field>
                  <Field label="Ngày cấp">
                    <Input name="issuedDate" defaultValue={extracted.issuedDate ?? ""} />
                  </Field>
                  <Field label="Ngày hết hạn nếu có">
                    <Input name="expiredDate" defaultValue={extracted.expiredDate ?? ""} />
                  </Field>
                  <Field className="sm:col-span-2" label="Số chứng thực / quyển số">
                    <Input name="verificationNumber" defaultValue={extracted.verificationNumber ?? ""} />
                  </Field>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="secondary" type="submit" name="action" value="draft">Lưu nháp</Button>
                <Button type="submit" name="action" value="review"><CheckCircle2 className="h-4 w-4" />Gửi duyệt</Button>
                <Button type="submit" name="action" value="approve">Lưu và duyệt</Button>
              </div>
            </form>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CertificatePreview({
  preview,
  rotation,
  onRotateLeft,
  onRotateRight
}: {
  preview: string;
  rotation: number;
  onRotateLeft: () => void;
  onRotateRight: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-3">
      <div className="flex h-80 items-center justify-center overflow-hidden rounded-xl bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- Dropzone previews can be blob URLs before upload. */}
        <img
          src={preview}
          alt="Preview chứng chỉ"
          style={{ transform: `rotate(${rotation}deg)` }}
          className="max-h-full max-w-full object-contain transition-transform"
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500">Xoay ảnh: {((rotation % 360) + 360) % 360}°</span>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onRotateLeft}><RotateCcw className="h-4 w-4" />Trái</Button>
          <Button type="button" variant="secondary" size="sm" onClick={onRotateRight}><RotateCw className="h-4 w-4" />Phải</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
