import { putObject } from "@/lib/storage";

export async function uploadCertificateFiles(files: File[]) {
  return Promise.all(
    files.map(async (file) => {
      return putObject(file);
    })
  );
}
