import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { put as putBlob } from "@vercel/blob";

export type StoredFile = {
  fileName: string;
  storageKey: string;
  url: string;
  thumbnailUrl?: string;
  sizeBytes: number;
  mimeType: string;
  checksum: string;
};

export async function putObject(file: File, folder = "certificates"): Promise<StoredFile> {
  assertAllowedUpload(file);
  assertStorageProviderReady();
  const extension = path.extname(file.name).toLowerCase();
  const safeBaseName = path.basename(file.name, extension).replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 80) || "upload";
  const storedName = `${Date.now()}-${randomUUID()}-${safeBaseName}${extension}`;
  const safeFolder = folder.replace(/[^a-zA-Z0-9-_/]+/g, "").replace(/^\/+|\/+$/g, "") || "uploads";
  const storageKey = `${safeFolder}/${storedName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const provider = process.env.STORAGE_PROVIDER || "local";

  if (provider !== "local") {
    return putConfiguredObjectStorage({ file, storageKey, checksum });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", safeFolder);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, storedName), bytes);

  const url = `/uploads/${safeFolder}/${storedName}`;
  return {
    fileName: file.name,
    storageKey,
    url,
    thumbnailUrl: file.type.startsWith("image/") ? url : "/placeholder-certificate.svg",
    sizeBytes: file.size,
    mimeType: file.type,
    checksum
  };
}

export async function getSignedUrl(storageKeyOrUrl: string, expiresInSeconds = 900) {
  if (storageKeyOrUrl.startsWith("/")) return storageKeyOrUrl;
  if (storageKeyOrUrl.startsWith("http")) return storageKeyOrUrl;
  if ((process.env.STORAGE_PROVIDER || "local") === "vercel_blob") {
    return storageKeyOrUrl;
  }
  if ((process.env.STORAGE_PROVIDER || "local") === "supabase") {
    const signed = await createSupabaseSignedUrl(storageKeyOrUrl, expiresInSeconds);
    if (signed) return signed;
  }
  const baseUrl = process.env.STORAGE_PUBLIC_BASE_URL;
  if (!baseUrl) return storageKeyOrUrl;
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  return `${baseUrl.replace(/\/$/, "")}/${storageKeyOrUrl}?expires=${expiresAt}`;
}

export function assertAllowedUpload(file: File, maxMb = Number(process.env.MAX_UPLOAD_MB ?? 20)) {
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) throw new Error("Unsupported file type");
  if (file.size > maxMb * 1024 * 1024) throw new Error("File too large");
}

function assertStorageProviderReady() {
  const provider = process.env.STORAGE_PROVIDER || "local";
  if (process.env.NODE_ENV === "production" && provider === "local") {
    throw new Error("STORAGE_PROVIDER must be object storage in production");
  }
  if (provider === "supabase" && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_STORAGE_BUCKET)) {
    throw new Error("Supabase Storage is not configured");
  }
  if (provider !== "local" && provider !== "supabase" && provider !== "vercel_blob") {
    throw new Error(`${provider} storage adapter is not implemented yet`);
  }
}

async function putConfiguredObjectStorage({
  file,
  storageKey,
  checksum
}: {
  file: File;
  storageKey: string;
  checksum: string;
}): Promise<StoredFile> {
  const provider = process.env.STORAGE_PROVIDER || "local";
  if (provider === "supabase") {
    return putSupabaseObject({ file, storageKey, checksum });
  }
  if (provider === "vercel_blob") {
    return putVercelBlobObject({ file, storageKey, checksum });
  }

  throw new Error(`${provider} storage adapter is not implemented yet`);
}

async function putVercelBlobObject({
  file,
  storageKey,
  checksum
}: {
  file: File;
  storageKey: string;
  checksum: string;
}): Promise<StoredFile> {
  const blob = await putBlob(storageKey, file, {
    access: "public",
    addRandomSuffix: false
  });

  return {
    fileName: file.name,
    storageKey,
    url: blob.url,
    thumbnailUrl: file.type.startsWith("image/") ? blob.url : "/placeholder-certificate.svg",
    sizeBytes: file.size,
    mimeType: file.type,
    checksum
  };
}

async function putSupabaseObject({
  file,
  storageKey,
  checksum
}: {
  file: File;
  storageKey: string;
  checksum: string;
}): Promise<StoredFile> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "certificates";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase Storage is not configured");

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${storageKey}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": file.type,
      "x-upsert": "false"
    },
    body: file
  });
  if (!response.ok) {
    throw new Error(`Supabase upload failed: ${response.status}`);
  }

  const signedUrl = await createSupabaseSignedUrl(storageKey, 900);

  return {
    fileName: file.name,
    storageKey,
    url: signedUrl ?? storageKey,
    thumbnailUrl: file.type.startsWith("image/") ? signedUrl ?? storageKey : "/placeholder-certificate.svg",
    sizeBytes: file.size,
    mimeType: file.type,
    checksum
  };
}

async function createSupabaseSignedUrl(storageKey: string, expiresInSeconds: number) {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "certificates";
  if (!supabaseUrl || !serviceRoleKey) return null;

  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${bucket}/${storageKey}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ expiresIn: expiresInSeconds })
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { signedURL?: string; signedUrl?: string };
  const signedPath = payload.signedURL ?? payload.signedUrl;
  if (!signedPath) return null;
  return signedPath.startsWith("http") ? signedPath : `${supabaseUrl}/storage/v1${signedPath}`;
}
