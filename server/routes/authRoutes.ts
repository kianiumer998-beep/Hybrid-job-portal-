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

// 3. Admin Login (Development/Testing passkey preserved + Production credentials)
authRouter.post('/admin-login', (req, res) => {
  try {
    const { password, passkey } = req.body;
    const testKey = passkey || password;

    // Preserve existing testing admin passkey 'admin123'
    if (testKey && verifyAdminDevPasskey(testKey)) {
      const { user, token } = createAdminDevSession();

      Database.addAuditLog({
        user: user.name,
        role: user.role,
        action: 'Admin Panel Authenticated (Testing Passkey)',
        target: 'System Management Suite',
        status: 'Success'
      });

      return res.json({
        success: true,
        message: 'Admin access authorized via testing passkey!',
        token,
        user,
        isDevelopmentMode: true
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid administrative passkey. Hint: default dev passkey is "admin123"'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Admin authentication error' });
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
