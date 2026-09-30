import type { Bindings } from '../types';
import { randomToken } from './security';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Identify the file by its actual bytes (magic numbers), never by the
// browser-supplied filename or content type. SVG is intentionally excluded
// because it can carry script.
function sniff(b: Uint8Array): { type: string; ext: string } | null {
  const starts = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  if (starts(0xff, 0xd8, 0xff)) return { type: 'image/jpeg', ext: 'jpg' };
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { type: 'image/png', ext: 'png' };
  if (starts(0x47, 0x49, 0x46, 0x38)) return { type: 'image/gif', ext: 'gif' };
  if (starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { type: 'image/webp', ext: 'webp' };
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return { type: 'application/pdf', ext: 'pdf' };
  return null;
}

export type UploadResult = { ok: true; key: string } | { ok: false; error: string };

export async function storeUpload(env: Bindings, file: File, userId: number, imagesOnly = false): Promise<UploadResult> {
  if (file.size === 0) return { ok: false, error: 'The file is empty.' };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: 'Files must be 10 MB or smaller. Try resizing the photo first.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return { ok: false, error: 'Only JPG, PNG, WebP, GIF images and PDF files can be uploaded.' };
  if (imagesOnly && !kind.type.startsWith('image/')) return { ok: false, error: 'Please choose an image file (JPG, PNG, WebP, or GIF).' };

  const key = `${new Date().toISOString().slice(0, 7)}-${randomToken(12)}.${kind.ext}`;
  const filename = (file.name || `upload.${kind.ext}`).replace(/[^\w.\- ]/g, '_').slice(0, 120);
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: kind.type } });
  await env.DB.prepare('INSERT INTO media (key, filename, content_type, size, uploaded_by) VALUES (?, ?, ?, ?, ?)')
    .bind(key, filename, kind.type, file.size, userId).run();
  return { ok: true, key };
}
