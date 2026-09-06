import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StorageProvider {
  save(fileName: string, buffer: Buffer, contentType: string): Promise<{ storageKey: string; relativeUrl: string }>;
  getStream(storageKey: string): Promise<{ stream: NodeJS.ReadableStream; contentType: string; size: number }>;
  exists(storageKey: string): Promise<boolean>;
  delete(storageKey: string): Promise<boolean>;
}

export class LocalDiskStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.join(process.cwd(), 'data', 'uploads', 'cvs');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async save(fileName: string, buffer: Buffer, contentType: string): Promise<{ storageKey: string; relativeUrl: string }> {
    const filePath = path.join(this.baseDir, fileName);
    fs.writeFileSync(filePath, buffer);
    return {
      storageKey: fileName,
      relativeUrl: `/api/applications/cv/${fileName}`
    };
  }

  async getStream(storageKey: string): Promise<{ stream: NodeJS.ReadableStream; contentType: string; size: number }> {
    const safeKey = path.basename(storageKey);
    const filePath = path.join(this.baseDir, safeKey);
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found in storage');
    }
    const stat = fs.statSync(filePath);
    const ext = path.extname(safeKey).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.doc') contentType = 'application/msword';
    else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    return {
      stream: fs.createReadStream(filePath),
      contentType,
      size: stat.size
    };
  }

  async exists(storageKey: string): Promise<boolean> {
    const safeKey = path.basename(storageKey);
    return fs.existsSync(path.join(this.baseDir, safeKey));
  }

  async delete(storageKey: string): Promise<boolean> {
    const safeKey = path.basename(storageKey);
    const filePath = path.join(this.baseDir, safeKey);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}

// Magic bytes validation
export function validateCvMagicBytes(buffer: Buffer, ext: string): boolean {
  if (buffer.length < 4) return false;

  if (ext === '.pdf') {
    // PDF magic bytes: %PDF- (0x25 0x50 0x44 0x46)
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  if (ext === '.doc') {
    // DOC magic bytes: 0xD0 0xCF 0x11 0xE0
    return buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
  }

  if (ext === '.docx') {
    // DOCX is a ZIP archive: PK\x03\x04 (0x50 0x4B 0x03 0x04)
    return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
  }

  return false;
}

const CV_TOKEN_SECRET = process.env.CV_TOKEN_SECRET || 'cv-storage-secure-token-secret-8819';

// Temporary download token generator for authorized download
export function generateCvDownloadToken(fileName: string, expiresInHours: number = 2): string {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
  const payload = `${fileName}:${expiresAt}`;
  const sig = crypto.createHmac('sha256', CV_TOKEN_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function verifyCvDownloadToken(fileName: string, token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const [tokenFileName, expiresAtStr, sig] = decoded.split(':');
    if (!tokenFileName || !expiresAtStr || !sig) return false;
    if (tokenFileName !== fileName) return false;

    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;

    const expectedSig = crypto.createHmac('sha256', CV_TOKEN_SECRET).update(`${tokenFileName}:${expiresAtStr}`).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

// Global active storage provider instance (pluggable with S3/GCS in cloud production)
export const cvStorage: StorageProvider = new LocalDiskStorageProvider();
