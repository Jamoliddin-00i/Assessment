import { put, del } from "@vercel/blob";

/**
 * Upload a file to Vercel Blob storage
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const blob = await put(filename, buffer, {
    access: "public",
    contentType,
  });
  return blob.url;
}

/**
 * Upload multiple files to Vercel Blob storage
 */
export async function uploadFiles(
  files: { buffer: Buffer; filename: string; contentType: string }[]
): Promise<string[]> {
  const urls = await Promise.all(
    files.map((file) => uploadFile(file.buffer, file.filename, file.contentType))
  );
  return urls;
}

/**
 * Delete a file from Vercel Blob storage
 */
export async function deleteFile(url: string): Promise<void> {
  await del(url);
}

/**
 * Generate a unique filename with timestamp
 */
export function generateFilename(
  prefix: string,
  originalName: string,
  index?: number
): string {
  const ext = originalName.substring(originalName.lastIndexOf(".")) || ".bin";
  const timestamp = Date.now();
  const suffix = index !== undefined ? `-${index}` : "";
  return `${prefix}-${timestamp}${suffix}${ext}`;
}
