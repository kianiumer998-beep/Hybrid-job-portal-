import { Router } from 'express';
import { Database } from '../db/database';
import { PaymentRepository, UserRepository } from '../db/repositories';
import { requireAdmin, requireAuth } from '../auth/authManager';

export const userRouter = Router();

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

function isUserAdmin(user: any): boolean {
  return Boolean(user && ADMIN_ROLES.includes(user.role));
}

// 1. Get All Users (Admin Only)
userRouter.get('/', requireAdmin, async (req, res) => {
  try {
    const rawUsers = await UserRepository.getAllAsync();
    const users = rawUsers.map(u => {
      const { passwordHash, salt, password, ...safe } = u;
      return safe;
    });
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching users' });
  }
});

// 1b. Get Single User Profile (Self or Admin)
userRouter.get('/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const isAdmin = isUserAdmin(req.user);
    const currentUserId = req.user?.userId || req.user?.id;

    if (!isAdmin && id !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only view your own profile.' });
    }

    const user = await UserRepository.getByIdAsync(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const { passwordHash, salt, password, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching user profile' });
  }
});

// 2. Get User Wallet Summary (Strictly authorization protected)
userRouter.get('/:id/wallet', requireAuth, async (req: any, res) => {
  try {
    const isAdmin = isUserAdmin(req.user);
    const currentUserId = req.user?.userId || req.user?.id;

    if (!isAdmin && req.params.id !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only view your own wallet.' });
    }

    const summary = await PaymentRepository.getUserWalletAsync(req.params.id);
    res.json({ success: true, wallet: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching user wallet' });
  }
});

// 3. User Saved Jobs
userRouter.get('/saved-jobs', requireAuth, (req: any, res) => {
  try {
    const isAdmin = isUserAdmin(req.user);
    const currentUserId = req.user?.userId || req.user?.id;
    const targetUserId = isAdmin && req.query.userId ? (req.query.userId as string) : currentUserId;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }
    const saved = Database.getSavedJobs(targetUserId);
    res.json({ success: true, savedJobs: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching saved jobs' });
  }
});

userRouter.post('/saved-jobs/toggle', requireAuth, (req: any, res) => {
  try {
    const { job } = req.body;
    const currentUserId = req.user?.userId || req.user?.id;
    if (!currentUserId || !job?.id) {
      return res.status(400).json({ success: false, message: 'Valid user session and job with id are required.' });
    }
    const result = Database.toggleSavedJob(currentUserId, job);
    res.json({ success: true, saved: result.saved, count: result.count });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error toggling saved job' });
  }
});

// 4. User Job Alerts
userRouter.get('/job-alerts', requireAuth, (req: any, res) => {
  try {
    const isAdmin = isUserAdmin(req.user);
    const currentUserId = req.user?.userId || req.user?.id;
    const targetUserId = isAdmin && req.query.userId ? (req.query.userId as string) : currentUserId;

    const alerts = Database.getJobAlerts(targetUserId);
    res.json({ success: true, alerts });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching alerts' });
  }
});

userRouter.post('/job-alerts', requireAuth, (req: any, res) => {
  try {
    const { keyword, city, jobType, frequency, email } = req.body;
    const currentUserId = req.user?.userId || req.user?.id;
    if (!keyword && !city && !jobType) {
      return res.status(400).json({ success: false, message: 'At least one filter criteria (keyword, city, jobType) is required.' });
    }
    const newAlert = Database.addJobAlert({
      userId: currentUserId,
      keyword,
      city,
      jobType,
      frequency: frequency || 'daily',
      email: email || req.user?.email
    });
    res.status(201).json({ success: true, alert: newAlert, message: 'Job alert created successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error creating job alert' });
  }
});

userRouter.delete('/job-alerts/:id', requireAuth, (req: any, res) => {
  try {
    const isAdmin = isUserAdmin(req.user);
    const currentUserId = req.user?.userId || req.user?.id;
    const targetUserId = isAdmin && req.query.userId ? (req.query.userId as string) : currentUserId;

    const deleted = Database.deleteJobAlert(req.params.id, targetUserId);
    res.json({ success: deleted, message: deleted ? 'Alert removed.' : 'Alert not found.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error deleting job alert' });
  }
});

// 5. User Documents (CVs & Portfolios)
userRouter.get('/documents', requireAuth, (req: any, res) => {
  try {
    const isAdmin = isUserAdmin(req.user);
    const currentUserId = req.user?.userId || req.user?.id;
    const targetUserId = isAdmin && req.query.userId ? (req.query.userId as string) : currentUserId;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }
    const docs = Database.getUserDocuments(targetUserId);
    res.json({ success: true, documents: docs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching documents' });
  }
});

userRouter.post('/documents', requireAuth, (req: any, res) => {
  try {
    const { title, type, fileUrl, fileSize, fileName } = req.body;
    const currentUserId = req.user?.userId || req.user?.id;
    if (!currentUserId || !title) {
      return res.status(400).json({ success: false, message: 'Valid user session and title are required.' });
    }
    const doc = Database.addUserDocument({
      userId: currentUserId,
      title,
      type: type || 'CV',
      fileUrl,
      fileSize,
      fileName
    });
    res.status(201).json({ success: true, document: doc, message: 'Document uploaded successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error adding document' });
  }
});

userRouter.delete('/documents/:id', requireAuth, (req: any, res) => {
  try {
    const isAdmin = isUserAdmin(req.user);
    const currentUserId = req.user?.userId || req.user?.id;
    const targetUserId = isAdmin && req.query.userId ? (req.query.userId as string) : currentUserId;

    if (!targetUserId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }
    const deleted = Database.deleteUserDocument(req.params.id, targetUserId);
    res.json({ success: deleted, message: deleted ? 'Document removed.' : 'Document not found.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error deleting document' });
  }
});

// 6. Update User Profile or Admin Status
userRouter.put('/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const isAdmin = isUserAdmin(req.user);
    const currentUserId = req.user?.userId || req.user?.id;

    let finalUpdates: Record<string, any>;

    if (!isAdmin) {
      if (id !== currentUserId) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only edit your own profile.' });
      }

      // Explicit allowlist of profile fields a normal user is permitted to self-update.
      // Strictly prevents modification of: role, walletBalance, membershipStatus, permissions,
      // plan, verified, kycStatus, activationDate, expiryDate, and administrative fields.
      const ALLOWED_NORMAL_USER_FIELDS = new Set([
        'name',
        'fullName',
        'phone',
        'phoneNumber',
        'bio',
        'location',
        'city',
        'country',
        'address',
        'avatarUrl',
        'company',
        'companyName',
        'headline',
        'title',
        'skills',
        'preferences',
        'website',
        'experience',
        'education',
        'cvUrl',
        'resumeUrl',
        'socialLinks',
        'notificationsEnabled',
        'whatsappAlertsEnabled'
      ]);

      finalUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        if (ALLOWED_NORMAL_USER_FIELDS.has(key)) {
          finalUpdates[key] = value;
        }
      }
    } else {
      // Administrators retain full administrative user management capabilities
      finalUpdates = { ...updates };
    }

    // Never allow updating passwordHash, salt, password, or primary ID directly via this endpoint
    delete finalUpdates.passwordHash;
    delete finalUpdates.salt;
    delete finalUpdates.password;
    delete finalUpdates.id;

    const updated = await UserRepository.updateAsync(id, finalUpdates);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const { passwordHash, salt, password, ...safeUser } = updated;
    res.json({ success: true, user: safeUser, message: 'User profile updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating user' });
  }
});
