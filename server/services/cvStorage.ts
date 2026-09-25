import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import { Readable } from 'stream';

export interface StorageProvider {
  save(fileName: string, buffer: Buffer, contentType: string): Promise<{ storageKey: string; relativeUrl: string }>;
  getStream(storageKey: string): Promise<{ stream: NodeJS.ReadableStream; contentType: string; size: number }>;
  exists(storageKey: string): Promise<boolean>;
  delete(storageKey: string): Promise<boolean>;
}

export interface CloudinaryConfig {
  cloudName: string;
  apiKey?: string;
  apiSecret?: string;
  uploadPreset?: string;
}

export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  if (cloudinaryUrl && cloudinaryUrl.startsWith('cloudinary://')) {
    try {
      // Format: cloudinary://api_key:api_secret@cloud_name
      const parsed = new URL(cloudinaryUrl);
      const cloudName = parsed.hostname;
      const apiKey = parsed.username;
      const apiSecret = parsed.password;
      if (cloudName && apiKey && apiSecret) {
        return { cloudName, apiKey, apiSecret };
      }
    } catch {
      // Fall through to individual env vars
    }
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const uploadPreset = process.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (cloudName && ((apiKey && apiSecret) || uploadPreset)) {
    return { cloudName, apiKey, apiSecret, uploadPreset };
  }

  return null;
}

/**
 * Cloudinary Persistent Cloud Storage Provider for CV Documents
 */
export class CloudinaryStorageProvider implements StorageProvider {
  private config: CloudinaryConfig;
  private urlMap: Map<string, string> = new Map();

  constructor(config: CloudinaryConfig) {
    this.config = config;
  }

  private getPublicId(fileName: string): string {
    return `hybrid_cv_portal/cvs/${fileName}`;
  }

  private getStandardSecureUrl(fileName: string): string {
    const publicId = this.getPublicId(fileName);
    return `https://res.cloudinary.com/${this.config.cloudName}/raw/upload/${publicId}`;
  }

  async save(fileName: string, buffer: Buffer, contentType: string): Promise<{ storageKey: string; relativeUrl: string }> {
    const publicId = this.getPublicId(fileName);
    const timestamp = Math.floor(Date.now() / 1000);
    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.config.cloudName}/raw/upload`;

    const payload: Record<string, string> = {
      file: `data:${contentType};base64,${buffer.toString('base64')}`,
      public_id: publicId,
      timestamp: String(timestamp)
    };

    if (this.config.apiKey && this.config.apiSecret) {
      payload.api_key = this.config.apiKey;
      // Generate signature from sorted params
      const signString = `public_id=${publicId}&timestamp=${timestamp}${this.config.apiSecret}`;
      payload.signature = crypto.createHash('sha1').update(signString).digest('hex');
    } else if (this.config.uploadPreset) {
      payload.upload_preset = this.config.uploadPreset;
    } else {
      throw new Error('Cloudinary credentials or upload preset missing.');
    }

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.secure_url) {
      const errMsg = data?.error?.message || `Cloudinary upload failed with status ${res.status}`;
      throw new Error(`Cloud storage upload failed: ${errMsg}`);
    }

    this.urlMap.set(fileName, data.secure_url);

    return {
      storageKey: fileName,
      relativeUrl: `/api/applications/cv/${fileName}`
    };
  }

  async getStream(storageKey: string): Promise<{ stream: NodeJS.ReadableStream; contentType: string; size: number }> {
    const safeKey = path.basename(storageKey);
    const targetUrl = this.urlMap.get(safeKey) || this.getStandardSecureUrl(safeKey);

    return new Promise((resolve, reject) => {
      const req = https.get(targetUrl, (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          return reject(new Error(`Failed to fetch CV file from cloud storage (Status: ${res.statusCode})`));
        }

        const ext = path.extname(safeKey).toLowerCase();
        let contentType = res.headers['content-type'] || 'application/octet-stream';
        if (ext === '.pdf') contentType = 'application/pdf';
        else if (ext === '.doc') contentType = 'application/msword';
        else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        const size = parseInt(res.headers['content-length'] || '0', 10);

        resolve({
          stream: res,
          contentType,
          size
        });
      });

      req.on('error', (err) => reject(new Error(`Cloud storage stream error: ${err.message}`)));
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Cloud storage request timed out'));
      });
    });
  }

  async exists(storageKey: string): Promise<boolean> {
    const safeKey = path.basename(storageKey);
    const targetUrl = this.urlMap.get(safeKey) || this.getStandardSecureUrl(safeKey);

    return new Promise((resolve) => {
      const parsed = new URL(targetUrl);
      const req = https.request({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'HEAD',
        timeout: 8000
      }, (res) => {
        resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 400);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });
  }

  async delete(storageKey: string): Promise<boolean> {
    const safeKey = path.basename(storageKey);
    const publicId = this.getPublicId(safeKey);

    if (!this.config.apiKey || !this.config.apiSecret) {
      return false;
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const signString = `public_id=${publicId}&timestamp=${timestamp}${this.config.apiSecret}`;
      const signature = crypto.createHash('sha1').update(signString).digest('hex');

      const destroyUrl = `https://api.cloudinary.com/v1_1/${this.config.cloudName}/raw/destroy`;
      const res = await fetch(destroyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_id: publicId,
          timestamp: String(timestamp),
          api_key: this.config.apiKey,
          signature
        })
      });

      const data = await res.json();
      return data?.result === 'ok';
    } catch {
      return false;
    }
  }
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

/**
 * Production Safe Error Storage Provider (Rejects ephemeral write if Cloudinary is not configured)
 */
export class ProductionErrorStorageProvider implements StorageProvider {
  async save(): Promise<{ storageKey: string; relativeUrl: string }> {
    throw new Error('Cloud storage (Cloudinary) is not configured in this production environment. Please provide CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME credentials.');
  }

  async getStream(): Promise<{ stream: NodeJS.ReadableStream; contentType: string; size: number }> {
    throw new Error('Cloud storage is not configured.');
  }

  async exists(): Promise<boolean> {
    return false;
  }

  async delete(): Promise<boolean> {
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

// Active storage provider factory
export function createCvStorageProvider(): StorageProvider {
  const config = getCloudinaryConfig();
  const isProduction = process.env.NODE_ENV === 'production';

  if (config) {
    return new CloudinaryStorageProvider(config);
  }

  if (isProduction) {
    return new ProductionErrorStorageProvider();
  }

  return new LocalDiskStorageProvider();
}

// Global active storage provider instance
export const cvStorage: StorageProvider = createCvStorageProvider();
