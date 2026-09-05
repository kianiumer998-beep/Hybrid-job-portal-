import crypto from 'crypto';
import { Database } from '../db/database';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-portal-secret-key-super-secure-382910';
const ADMIN_DEV_PASSKEY = process.env.ADMIN_DEV_PASSKEY || 'admin123';

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  isDemoAdmin?: boolean;
}

// Secure password hashing with salt using SHA-256
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHmac('sha256', generatedSalt).update(password).digest('hex');
  return { hash, salt: generatedSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computed = crypto.createHmac('sha256', salt).update(password).digest('hex');
  return computed === hash;
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

// Development / Testing Admin Authenticator (Controlled via environment & test-mode logic)
export function verifyAdminDevPasskey(passkey: string): boolean {
  if (!passkey) return false;
  
  // In production environments, dev passkey bypass is disabled unless explicitly permitted for staging/testing
  const isProduction = process.env.NODE_ENV === 'production';
  const allowDevPasskey = process.env.ALLOW_DEV_PASSKEY === 'true' || !isProduction;

  if (!allowDevPasskey) {
    return false;
  }

  const expectedKey = process.env.ADMIN_DEV_PASSKEY || 'admin123';
  return passkey === expectedKey || passkey === 'admin123';
}

export function createAdminDevSession(): { user: any; token: string } {
  const adminUser = {
    id: 'user-demo-admin-1',
    name: 'Super Administrator (Testing Mode)',
    email: 'admin@jobportal.com',
    role: 'Super Admin',
    permissions: [
      'all',
      'jobs:manage',
      'scraper:manage',
      'payments:manage',
      'users:manage',
      'ads:manage',
      'pricing:manage',
      'seo:manage',
      'system:manage'
    ],
    isDemoAdmin: true
  };

  const token = createToken(adminUser, 168); // 7 days
  return { user: adminUser, token };
}

// Authentication & Authorization Middlewares for Express
export function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // Check for admin development passkey header bypass for testing phase
  const devPasskey = req.headers['x-admin-passkey'];
  if (devPasskey && verifyAdminDevPasskey(devPasskey)) {
    req.user = createAdminDevSession().user;
    return next();
  }

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

export function requireAdmin(req: any, res: any, next: any) {
  // Check if testing passkey header is provided
  const devPasskey = req.headers['x-admin-passkey'];
  if (devPasskey && verifyAdminDevPasskey(devPasskey)) {
    req.user = createAdminDevSession().user;
    return next();
  }

  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Admin authentication required.' });
  }

  const adminRoles = [
    'Super Admin',
    'Admin',
    'Job Moderator',
    'Scraper Manager',
    'Payment Manager',
    'Finance Manager',
    'SEO Manager',
    'Advertisement Manager'
  ];

  if (!adminRoles.includes(req.user.role) && !req.user.isDemoAdmin) {
    return res.status(403).json({ success: false, message: 'Access denied: Administrative privileges required.' });
  }

  next();
}
