import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import { getCloudinaryConfig } from './cvStorage';

export interface AttachmentStorageResult {
  storedFileName: string;
  fileUrl: string;
  sizeBytes: number;
  contentType: string;
}

const ATTACHMENT_DIR = path.join(process.cwd(), 'data', 'uploads', 'attachments');

// Ensure attachments directory exists
if (!fs.existsSync(ATTACHMENT_DIR)) {
  fs.mkdirSync(ATTACHMENT_DIR, { recursive: true });
}

export function validateAttachmentMagicBytes(buffer: Buffer, ext: string): boolean {
  if (buffer.length < 4) return false;

  const normalizedExt = ext.toLowerCase();

  // PDF: %PDF- (0x25 0x50 0x44 0x46)
  if (normalizedExt === '.pdf') {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  // JPEG / JPG: 0xFF 0xD8 0xFF
  if (normalizedExt === '.jpg' || normalizedExt === '.jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // PNG: 0x89 0x50 0x4E 0x47 (0x89 'P' 'N' 'G')
  if (normalizedExt === '.png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }

  // WEBP: 'RIFF' .... 'WEBP'
  if (normalizedExt === '.webp') {
    if (buffer.length < 12) return false;
    const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
    const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
    return isRiff && isWebp;
  }

  return false;
}

export function getAttachmentMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

export async function saveAttachment(
  originalFileName: string,
  buffer: Buffer,
  declaredMimeType?: string
): Promise<AttachmentStorageResult> {
  const ext = path.extname(originalFileName).toLowerCase();
  const safeBase = path.basename(originalFileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40) || 'doc';
  const uniqueToken = crypto.randomBytes(8).toString('hex');
  const storedFileName = `${Date.now()}-${uniqueToken}-${safeBase}${ext}`;
  const contentType = declaredMimeType || getAttachmentMimeType(originalFileName);

  // Always persist local copy in ATTACHMENT_DIR for proxy streaming and reliability
  const targetPath = path.join(ATTACHMENT_DIR, storedFileName);
  fs.writeFileSync(targetPath, buffer);

  const cloudinaryConfig = getCloudinaryConfig();

  if (cloudinaryConfig && cloudinaryConfig.cloudName) {
    try {
      const publicId = `hybrid_job_portal/attachments/${path.basename(storedFileName, ext)}`;
      const timestamp = Math.floor(Date.now() / 1000);
      const isImg = ext !== '.pdf';
      const resourceType = isImg ? 'image' : 'raw';
      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`;

      const payload: Record<string, string> = {
        file: `data:${contentType};base64,${buffer.toString('base64')}`,
        public_id: publicId,
        timestamp: String(timestamp)
      };

      if (cloudinaryConfig.apiKey && cloudinaryConfig.apiSecret) {
        payload.api_key = cloudinaryConfig.apiKey;
        const signString = `public_id=${publicId}&timestamp=${timestamp}${cloudinaryConfig.apiSecret}`;
        payload.signature = crypto.createHash('sha1').update(signString).digest('hex');
      } else if (cloudinaryConfig.uploadPreset) {
        payload.upload_preset = cloudinaryConfig.uploadPreset;
      }

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.secure_url) {
        return {
          storedFileName,
          fileUrl: data.secure_url,
          sizeBytes: buffer.length,
          contentType
        };
      }
    } catch (cloudErr) {
      console.warn('[AttachmentStorage] Cloudinary upload fallback to local storage:', cloudErr);
    }
  }

  return {
    storedFileName,
    fileUrl: `/api/jobs/attachments/${storedFileName}`,
    sizeBytes: buffer.length,
    contentType
  };
}

export function getAttachmentStream(fileName: string): { stream: fs.ReadStream; contentType: string; size: number } | null {
  const safeName = path.basename(fileName);
  const targetPath = path.join(ATTACHMENT_DIR, safeName);

  if (!fs.existsSync(targetPath)) {
    return null;
  }

  const stat = fs.statSync(targetPath);
  const contentType = getAttachmentMimeType(safeName);

  return {
    stream: fs.createReadStream(targetPath),
    contentType,
    size: stat.size
  };
}

export function deleteAttachmentFile(fileNameOrUrl: string): boolean {
  try {
    const rawFileName = fileNameOrUrl.includes('/') ? fileNameOrUrl.split('/').pop()?.split('?')[0] || '' : fileNameOrUrl;
    const safeName = path.basename(rawFileName);
    const targetPath = path.join(ATTACHMENT_DIR, safeName);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[AttachmentStorage] Error deleting attachment file:', err);
    return false;
  }
}
