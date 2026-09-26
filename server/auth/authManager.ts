import crypto from 'crypto';
import { Database } from '../db/database';
import { UserRepository } from '../db/repositories/UserRepository';

function resolveJwtSecret(): string {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!configuredSecret) {
    if (isProduction) {
      throw new Error(
        'FATAL SECURITY CONFIGURATION ERROR: process.env.JWT_SECRET is missing. Production requires an explicit JWT_SECRET of at least 32 characters.'
      );
    }
    // Non-production ephemeral random secret (64 hex chars) so dev environment never uses a static hardcoded fallback
    return crypto.randomBytes(32).toString('hex');
  }

  if (configuredSecret.length < 32) {
    throw new Error(
      'FATAL SECURITY CONFIGURATION ERROR: process.env.JWT_SECRET must be at least 32 characters long.'
    );
  }

  return configuredSecret;
}

const JWT_SECRET = resolveJwtSecret();

export const ADMIN_PERMISSIONS = [
  'jobs.manage',
  'applications.manage',
  'scraper.manage',
  'payments.manage',
  'finance.manage',
  'seo.manage',
  'advertisements.manage',
  'users.manage',
  'settings.manage',
  'audit.view'
] as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[number];

export const ADMIN_ROLES = [
  'Super Admin',
  'Admin',
  'Job Moderator',
  'Scraper Manager',
  'Payment Manager',
  'Finance Manager',
  'SEO Manager',
  'Advertisement Manager'
] as const;

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  'Super Admin': ['*'],
  'Admin': ['*'],
  'Job Moderator': ['jobs.manage', 'applications.manage'],
  'Scraper Manager': ['scraper.manage'],
  'Payment Manager': ['payments.manage'],
  'Finance Manager': ['finance.manage', 'payments.manage'],
  'SEO Manager': ['seo.manage'],
  'Advertisement Manager': ['advertisements.manage']
};

export function getPermissionsForRole(role?: string): string[] {
  if (!role) return [];
  const perms = DEFAULT_ROLE_PERMISSIONS[role];
  return perms ? [...perms] : [];
}

export function hasAdminPermission(role?: string, permission?: string): boolean {
  if (!role || !(ADMIN_ROLES as readonly string[]).includes(role)) {
    return false;
  }
  if (role === 'Super Admin' || role === 'Admin') {
    return true;
  }
  if (!permission) {
    return true;
  }
  const perms = DEFAULT_ROLE_PERMISSIONS[role] || [];
  return perms.includes('*') || perms.includes(permission);
}

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

// Secure password hashing with salt using crypto.scrypt (OWASP recommended memory-hard hashing)
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, generatedSalt, 64);
  return { hash: derivedKey.toString('hex'), salt: generatedSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  // 1. Primary: crypto.scrypt (OWASP recommended memory-hard hashing)
  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const hashBuf = Buffer.from(hash, 'hex');
    if (hashBuf.length === derivedKey.length && crypto.timingSafeEqual(hashBuf, derivedKey)) {
      return true;
    }
  } catch {}

  // 2. Fallback: HMAC-SHA256 with salt
  try {
    const computed = crypto.createHmac('sha256', salt).update(password).digest('hex');
    const computedBuf = Buffer.from(computed, 'hex');
    const hashBuf = Buffer.from(hash, 'hex');
    if (computedBuf.length === hashBuf.length && crypto.timingSafeEqual(computedBuf, hashBuf)) {
      return true;
    }
  } catch {}

  // 3. Fallback: Standard SHA-256 for initial seed accounts
  try {
    const plain = crypto.createHash('sha256').update(password).digest('hex');
    const plainBuf = Buffer.from(plain, 'hex');
    const hashBuf = Buffer.from(hash, 'hex');
    if (plainBuf.length === hashBuf.length && crypto.timingSafeEqual(plainBuf, hashBuf)) {
      return true;
    }
  } catch {}

  return false;
}

// Stateless signed token generator (HMAC SHA-256)
export function createToken(payload: Record<string, any>, expiresInHours: number = 72): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + (expiresInHours * 3600);
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

// Authentication & Authorization Middlewares for Express
export function authMiddleware(req: any, res: any, next: any) {
  // Disallow any bypass headers such as x-admin-passkey
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    req.user = null;
    return next();
  }

  const payload = verifyToken(token);
  req.user = payload;
  next();
}

export function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
  }
  next();
}

export async function requireAdmin(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Admin authentication required.' });
  }

  try {
    const userId = req.user.userId || req.user.id;
    const dbUser = userId ? await UserRepository.getByIdAsync(userId) : null;
    if (dbUser && dbUser.role !== req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Your administrative role has changed. Please log in again to refresh your session.'
      });
    }

    const effectiveRole = dbUser?.role || req.user.role;
    if (!(ADMIN_ROLES as readonly string[]).includes(effectiveRole)) {
      return res.status(403).json({ success: false, message: 'Access denied: Administrative privileges required.' });
    }

    req.user.role = effectiveRole;
    req.user.permissions = getPermissionsForRole(effectiveRole);
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Authorization verification error.' });
  }
}

export function requireAdminPermission(permission: string) {
  return async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Admin authentication required.' });
    }

    try {
      const userId = req.user.userId || req.user.id;
      const dbUser = userId ? await UserRepository.getByIdAsync(userId) : null;
      if (dbUser && dbUser.role !== req.user.role) {
        return res.status(401).json({
          success: false,
          message: 'Your administrative role has changed. Please log in again to refresh your session.'
        });
      }

      const effectiveRole = dbUser?.role || req.user.role;
      if (!(ADMIN_ROLES as readonly string[]).includes(effectiveRole)) {
        return res.status(403).json({ success: false, message: 'Access denied: Administrative privileges required.' });
      }

      req.user.role = effectiveRole;
      req.user.permissions = getPermissionsForRole(effectiveRole);

      if (!hasAdminPermission(effectiveRole, permission)) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Role '${effectiveRole}' does not have required permission '${permission}'.`
        });
      }

      next();
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Authorization verification error.' });
    }
  };
}
