import { Router } from 'express';
import { Database } from '../db/database';
import { 
  hashPassword, 
  verifyPassword, 
  createToken, 
  verifyAdminDevPasskey, 
  createAdminDevSession,
  requireAuth 
} from '../auth/authManager';

export const authRouter = Router();

// 1. User Registration
authRouter.post('/register', (req, res) => {
  try {
    const { name, email, password, role, phone, companyName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const existing = Database.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email address already exists.' });
    }

    const { hash, salt } = hashPassword(password);
    const newUser = Database.addUser({
      name,
      email: email.toLowerCase().trim(),
      passwordHash: hash,
      salt,
      role: role || 'Job Seeker',
      phone: phone || '',
      companyName: companyName || '',
      plan: 'Free',
      walletBalance: 0,
      membershipStatus: 'Active',
      autoRenew: false
    });

    const token = createToken({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role
    });

    // Sanitized user without sensitive credentials
    const { passwordHash, salt: _, ...safeUser } = newUser;

    Database.addAuditLog({
      user: safeUser.name,
      role: safeUser.role,
      action: 'User Registered',
      target: safeUser.email,
      status: 'Success'
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: safeUser
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Internal registration error' });
  }
});

// 2. User Login
authRouter.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = Database.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email address or password.' });
    }

    // Verify password hash or fallback to demo accounts
    let isValid = false;
    if (user.passwordHash && user.salt) {
      isValid = verifyPassword(password, user.passwordHash, user.salt);
    } else if (user.password) {
      // Legacy plaintext check for mock accounts
      isValid = user.password === password;
    }

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid email address or password.' });
    }

    const token = createToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });

    const { passwordHash, salt, password: _, ...safeUser } = user;

    Database.addAuditLog({
      user: safeUser.name,
      role: safeUser.role,
      action: 'User Login',
      target: safeUser.email,
      status: 'Success'
    });

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: safeUser
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Login error' });
  }
});

// In-memory brute-force protection / rate limiter for admin and auth endpoints
const loginAttempts = new Map<string, { count: number; firstAttempt: number; lockedUntil?: number }>();
const MAX_ATTEMPTS = 10; // Max failed attempts before temporary lockout
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

function checkRateLimit(ip: string): { blocked: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { blocked: false };

  if (entry.lockedUntil && now < entry.lockedUntil) {
    return { blocked: true, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
  }

  if (now - entry.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(ip);
    return { blocked: false };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    return { blocked: true, retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000) };
  }

  return { blocked: false };
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || (now - entry.firstAttempt > WINDOW_MS)) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) {
      entry.lockedUntil = now + LOCKOUT_MS;
    }
  }
}

function clearAttempts(ip: string) {
  loginAttempts.delete(ip);
}

// 3. Admin Login (Requires valid admin account credentials; verifies existing test admin 'admin123')
authRouter.post('/admin-login', (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
    const rateCheck = checkRateLimit(ip);
    if (rateCheck.blocked) {
      return res.status(429).json({
        success: false,
        message: `Too many failed login attempts. Please try again in ${rateCheck.retryAfterSeconds || 60} seconds.`
      });
    }

    const { email, password, passkey } = req.body;
    const adminPassword = (password || passkey || '').toString().trim();
    const adminEmail = (email || 'admin@jobportal.com').toString().trim().toLowerCase();

    if (!adminPassword) {
      return res.status(400).json({ success: false, message: 'Password is required.' });
    }

    // Locate administrative account
    const user = Database.getUserByEmail(adminEmail);
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

    if (!user || (!adminRoles.includes(user.role) && !user.isDemoAdmin)) {
      recordFailedAttempt(ip);
      return res.status(401).json({
        success: false,
        message: 'Invalid administrative credentials.'
      });
    }

    // Verify password against stored hash or legacy verified password
    let isValid = false;
    if (user.passwordHash && user.salt) {
      isValid = verifyPassword(adminPassword, user.passwordHash, user.salt);
    } else if (user.password) {
      isValid = user.password === adminPassword;
    }

    // Preserve existing test admin credentials (admin@jobportal.com / admin123)
    if (!isValid && user.email === 'admin@jobportal.com' && adminPassword === 'admin123') {
      isValid = true;
    }

    if (!isValid) {
      recordFailedAttempt(ip);
      return res.status(401).json({
        success: false,
        message: 'Invalid administrative credentials.'
      });
    }

    // Successful login: reset rate limiter
    clearAttempts(ip);

    const token = createToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions || ['all']
    }, 168);

    const { passwordHash: _ph, salt: _s, password: _p, ...safeUser } = user;

    Database.addAuditLog({
      user: safeUser.name,
      role: safeUser.role,
      action: 'Admin Panel Authenticated',
      target: 'System Management Suite',
      status: 'Success'
    });

    return res.json({
      success: true,
      message: 'Admin access authorized successfully.',
      token,
      user: safeUser
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Admin authentication error.' });
  }
});

// 4. Current Authenticated User Session
authRouter.get('/me', requireAuth, (req: any, res) => {
  try {
    if (req.user.isDemoAdmin) {
      return res.json({ success: true, user: req.user });
    }

    const user = Database.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User record not found.' });
    }

    const { passwordHash, salt, password, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Session error' });
  }
});

// 5. Logout
authRouter.post('/logout', (req: any, res) => {
  if (req.user) {
    Database.addAuditLog({
      user: req.user.name || 'User',
      role: req.user.role || 'Member',
      action: 'Session Logged Out',
      target: req.user.email || 'App Client',
      status: 'Success'
    });
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});
