import { Router } from 'express';
import { Database } from '../db/database';
import { UserRepository, AuditRepository } from '../db/repositories';
import { 
  hashPassword, 
  verifyPassword, 
  createToken, 
  requireAuth,
  requireAdminPermission,
  getPermissionsForRole
} from '../auth/authManager';

export const authRouter = Router();

const ADMIN_ROLES = [
  'Super Admin',
  'Admin',
  'Job Moderator',
  'Scraper Manager',
  'Payment Manager',
  'Finance Manager',
  'SEO Manager',
  'Advertisement Manager'
];

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

// 1. User Registration (Public - Admin roles strictly blocked)
authRouter.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, companyName } = req.body || {};

    const cleanName = (name || '').toString().trim();
    const cleanEmail = (email || '').toString().toLowerCase().trim();
    const rawPassword = (password || '').toString();

    if (!cleanName || !cleanEmail || !rawPassword) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    if (rawPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const existing = await UserRepository.getByEmailAsync(cleanEmail);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email address already exists.' });
    }

    const { hash, salt } = hashPassword(rawPassword);

    const requestedRole = (role || '').toString().trim();
    const safeRegistrationRole = ADMIN_ROLES.includes(requestedRole) ? 'Job Seeker' : (requestedRole || 'Job Seeker');

    const newUser = await UserRepository.createAsync({
      name: cleanName,
      email: cleanEmail,
      passwordHash: hash,
      salt,
      role: safeRegistrationRole,
      phone: (phone || '').toString().trim(),
      companyName: (companyName || '').toString().trim(),
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

    const { passwordHash, salt: _, password: _p, ...safeUser } = newUser;

    AuditRepository.add({
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
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = (email || '').toString().toLowerCase().trim();
    const rawPassword = (password || '').toString();

    if (!cleanEmail || !rawPassword) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await UserRepository.getByEmailAsync(cleanEmail);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email address or password.' });
    }

    let isValid = false;
    if (user.passwordHash && user.salt) {
      isValid = verifyPassword(rawPassword, user.passwordHash, user.salt);
    } else if (user.password) {
      isValid = user.password === rawPassword;
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

    AuditRepository.add({
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

// 3. Admin Login (Requires real administrative account email & password)
authRouter.post('/admin-login', async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
    const rateCheck = checkRateLimit(ip);
    if (rateCheck.blocked) {
      return res.status(429).json({
        success: false,
        message: `Too many failed login attempts. Please try again in ${rateCheck.retryAfterSeconds || 60} seconds.`
      });
    }

    const { email, password, passkey } = req.body || {};
    const adminEmail = (email || 'admin@jobportal.com').toString().trim().toLowerCase();
    const adminPassword = (password || passkey || '').toString();

    if (!adminPassword) {
      return res.status(400).json({ success: false, message: 'Admin email and password are required.' });
    }

    // Locate administrative account in authoritative store
    const user = await UserRepository.getByEmailAsync(adminEmail);

    if (!user || !ADMIN_ROLES.includes(user.role)) {
      recordFailedAttempt(ip);
      return res.status(401).json({
        success: false,
        message: 'Invalid administrative credentials.'
      });
    }

    // Verify password strictly against stored hash and salt
    let isValid = false;
    if (user.passwordHash && user.salt) {
      isValid = verifyPassword(adminPassword, user.passwordHash, user.salt);
    } else if (user.password) {
      isValid = user.password === adminPassword;
    }

    if (!isValid) {
      recordFailedAttempt(ip);
      return res.status(401).json({
        success: false,
        message: 'Invalid administrative credentials.'
      });
    }

    // Successful login: reset brute-force counter
    clearAttempts(ip);

    const resolvedPermissions = getPermissionsForRole(user.role);
    const token = createToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: resolvedPermissions
    }, 168);

    const { passwordHash: _ph, salt: _s, password: _p, ...safeUser } = user;
    safeUser.permissions = resolvedPermissions;

    AuditRepository.add({
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

// 4. Change Password (Authenticated user - Admin or Member)
authRouter.post('/change-password', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { currentPassword, newPassword } = req.body || {};
    const rawCurrent = (currentPassword || '').toString();
    const rawNew = (newPassword || '').toString();

    if (!rawCurrent || !rawNew) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }

    if (rawNew.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const user = await UserRepository.getByIdAsync(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User record not found.' });
    }

    let isCurrentValid = false;
    if (user.passwordHash && user.salt) {
      isCurrentValid = verifyPassword(rawCurrent, user.passwordHash, user.salt);
    } else if (user.password) {
      isCurrentValid = user.password === rawCurrent;
    }

    if (!isCurrentValid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    // Hash new password securely
    const { hash: newHash, salt: newSalt } = hashPassword(rawNew);

    const updatedUser = await UserRepository.updateAsync(user.id, {
      passwordHash: newHash,
      salt: newSalt,
      password: null,
      updatedAt: new Date().toISOString()
    });

    if (!updatedUser) {
      return res.status(500).json({ success: false, message: 'Failed to update password.' });
    }

    // Generate a fresh signed token
    const resolvedPermissions = getPermissionsForRole(updatedUser.role);
    const freshToken = createToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
      permissions: resolvedPermissions
    }, ADMIN_ROLES.includes(updatedUser.role) ? 168 : 72);

    AuditRepository.add({
      user: updatedUser.name,
      role: updatedUser.role,
      action: 'Password Changed',
      target: updatedUser.email,
      status: 'Success'
    });

    const { passwordHash: _ph, salt: _s, password: _p, ...safeUser } = updatedUser;

    return res.json({
      success: true,
      message: 'Password changed successfully.',
      token: freshToken,
      user: safeUser
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating password.' });
  }
});

// 5. Admin Bootstrap (Controlled one-time bootstrap via environment key)
authRouter.post('/admin-bootstrap', async (req, res) => {
  try {
    const isEnabled = process.env.ADMIN_BOOTSTRAP_ENABLED === 'true';
    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Admin bootstrap is disabled. Set ADMIN_BOOTSTRAP_ENABLED=true in environment variables to enable.'
      });
    }

    const envKey = (process.env.ADMIN_BOOTSTRAP_KEY || '').trim();
    if (!envKey) {
      return res.status(403).json({
        success: false,
        message: 'ADMIN_BOOTSTRAP_KEY is not configured in server environment.'
      });
    }

    const requestKey = (req.headers['x-bootstrap-key'] || req.body?.bootstrapKey || '').toString().trim();
    if (requestKey !== envKey) {
      return res.status(401).json({ success: false, message: 'Invalid bootstrap key.' });
    }

    const bootstrapEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || req.body?.email || 'admin@jobportal.com').toString().trim().toLowerCase();
    const bootstrapPassword = (process.env.ADMIN_BOOTSTRAP_PASSWORD || req.body?.password || '').toString().trim();
    const bootstrapName = (process.env.ADMIN_BOOTSTRAP_NAME || req.body?.name || 'Super Administrator').toString().trim();

    if (!bootstrapPassword || bootstrapPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Valid bootstrap password (min 6 characters) must be configured via ADMIN_BOOTSTRAP_PASSWORD or request body.'
      });
    }

    const { hash, salt } = hashPassword(bootstrapPassword);

    const existingAdmin = await UserRepository.getByEmailAsync(bootstrapEmail);

    let finalAdmin: any;
    if (existingAdmin) {
      finalAdmin = await UserRepository.updateAsync(existingAdmin.id, {
        name: bootstrapName || existingAdmin.name,
        role: 'Super Admin',
        passwordHash: hash,
        salt,
        password: null,
        permissions: ['all'],
        membershipStatus: 'Active',
        updatedAt: new Date().toISOString()
      });
    } else {
      finalAdmin = await UserRepository.createAsync({
        name: bootstrapName,
        email: bootstrapEmail,
        role: 'Super Admin',
        passwordHash: hash,
        salt,
        permissions: ['all'],
        membershipStatus: 'Active',
        plan: 'Premium',
        walletBalance: 100000
      });
    }

    AuditRepository.add({
      user: 'System Bootstrap',
      role: 'Super Admin',
      action: 'Admin Account Bootstrapped',
      target: bootstrapEmail,
      status: 'Success'
    });

    const { passwordHash: _ph, salt: _s, password: _p, ...safeUser } = finalAdmin;

    return res.json({
      success: true,
      message: 'Super Admin account successfully bootstrapped! Disable ADMIN_BOOTSTRAP_ENABLED in production.',
      user: safeUser
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Bootstrap failed.' });
  }
});

// 6. Current Authenticated User Session
authRouter.get('/me', requireAuth, async (req: any, res) => {
  try {
    const user = await UserRepository.getByIdAsync(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User record not found.' });
    }

    const { passwordHash, salt, password, ...safeUser } = user;
    safeUser.permissions = getPermissionsForRole(user.role);
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Session error' });
  }
});

// 7. Admin Role Management (Requires users.manage; restricted to Super Admin / Admin)
const VALID_ASSIGNABLE_ROLES = [
  'Job Seeker',
  'Employer',
  'Job Moderator',
  'Scraper Manager',
  'Payment Manager',
  'Finance Manager',
  'SEO Manager',
  'Advertisement Manager',
  'Admin',
  'Super Admin'
];

authRouter.patch('/users/:id/role', requireAdminPermission('users.manage'), async (req: any, res) => {
  try {
    const targetUserId = (req.params.id || '').toString().trim();
    const newRole = (req.body?.role || '').toString().trim();

    if (!targetUserId || !newRole) {
      return res.status(400).json({ success: false, message: 'Target user ID and role are required.' });
    }

    if (!VALID_ASSIGNABLE_ROLES.includes(newRole)) {
      return res.status(400).json({ success: false, message: `Invalid role '${newRole}'.` });
    }

    const actorId = req.user?.userId || req.user?.id;
    const actor = actorId ? await UserRepository.getByIdAsync(actorId) : null;
    const actorRole = actor?.role || req.user?.role;

    // Only Super Admin or Admin may assign administrative roles
    if (actorRole !== 'Super Admin' && actorRole !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only Super Admin or Admin may manage user roles.'
      });
    }

    // Prevent a user from changing their own role (prevents self-elevation and accidental self-demotion)
    if (String(targetUserId) === String(actorId)) {
      return res.status(403).json({
        success: false,
        message: 'Action blocked: You cannot change your own administrative role.'
      });
    }

    const targetUser = await UserRepository.getByIdAsync(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target user not found.' });
    }

    const oldRole = targetUser.role || 'Job Seeker';

    // Only an existing Super Admin can assign the Super Admin role or modify an existing Super Admin
    if (newRole === 'Super Admin' && actorRole !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only an existing Super Admin can assign the Super Admin role.'
      });
    }

    if (oldRole === 'Super Admin' && actorRole !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only a Super Admin can modify another Super Admin account.'
      });
    }

    // Prevent changing the last/only Super Admin into a lower role
    if (oldRole === 'Super Admin' && newRole !== 'Super Admin') {
      const allUsers = await UserRepository.getAllAsync();
      const superAdminCount = allUsers.filter(u => u && u.role === 'Super Admin').length;
      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Action blocked: Cannot demote the last remaining Super Admin account.'
        });
      }
    }

    const updatedPermissions = getPermissionsForRole(newRole);

    const updatedUser = await UserRepository.updateAsync(targetUser.id, {
      role: newRole,
      permissions: updatedPermissions
    });

    if (!updatedUser) {
      return res.status(500).json({ success: false, message: 'Failed to update user role.' });
    }

    AuditRepository.add({
      user: actor?.name || req.user?.name || req.user?.email || 'Administrator',
      role: actorRole,
      action: 'User Role Updated',
      target: `${targetUser.email} (${oldRole} -> ${newRole})`,
      status: 'Success',
      metadata: {
        actorId,
        actorRole,
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email,
        oldRole,
        newRole,
        permissions: updatedPermissions
      }
    });

    const { passwordHash, salt, password, ...safeUser } = updatedUser;
    safeUser.permissions = updatedPermissions;

    return res.json({
      success: true,
      message: `Role for ${safeUser.name || safeUser.email} updated from '${oldRole}' to '${newRole}'.`,
      user: safeUser
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error updating user role.' });
  }
});

// 7. Logout
authRouter.post('/logout', (req: any, res) => {
  if (req.user) {
    AuditRepository.add({
      user: req.user.name || 'User',
      role: req.user.role || 'Member',
      action: 'Session Logged Out',
      target: req.user.email || 'App Client',
      status: 'Success'
    });
  }
  res.json({ success: true, message: 'Logged out successfully.' });
});
