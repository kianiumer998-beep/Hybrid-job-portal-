import { Router } from 'express';
import path from 'path';
import { Database } from '../db/database';
import { AuditRepository, PaymentRepository, UserRepository } from '../db/repositories';
import { requireAdminPermission, requireAuth, hasAdminPermission, getPermissionsForRole } from '../auth/authManager';

export const userRouter = Router();

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

const ALLOWED_ADMIN_USER_FIELDS = new Set([
  ...ALLOWED_NORMAL_USER_FIELDS,
  'plan',
  'membershipStatus',
  'paymentStatus',
  'autoRenew',
  'expiryDate',
  'activationDate',
  'renewalCount',
  'adminNotes',
  'verificationStatus',
  'kycStatus'
]);

const PROTECTED_ADMIN_UPDATE_FIELDS = new Set([
  '_id',
  'id',
  'role',
  'permissions',
  'walletBalance',
  'passwordHash',
  'salt',
  'password',
  'transactions',
  'appliedJobs',
  'createdAt',
  'updatedAt'
]);

const VALID_USER_PLANS = new Set(['Free', 'Premium']);
const VALID_MEMBERSHIP_STATUSES = new Set(['Active', 'Revoked', 'Expired', 'Unpaid']);
const VALID_PAYMENT_STATUSES = new Set(['Paid', 'Unpaid', 'Overdue']);
const PROTECTED_SYSTEM_ACCOUNT_IDS = new Set(['system', 'system-admin', 'admin-bootstrap']);

function isValidUserIdParam(id: string): boolean {
  return Boolean(id && id.length <= 128 && !id.includes('\0') && !id.includes('/') && !id.includes('\\'));
}

function isValidUserDateString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return false;

  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    const hour = ymdMatch[4] !== undefined ? Number(ymdMatch[4]) : 0;
    const minute = ymdMatch[5] !== undefined ? Number(ymdMatch[5]) : 0;
    const second = ymdMatch[6] !== undefined ? Number(ymdMatch[6]) : 0;
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
      return false;
    }
    const utcCheck = new Date(Date.UTC(year, month - 1, day));
    if (
      utcCheck.getUTCFullYear() !== year ||
      utcCheck.getUTCMonth() !== month - 1 ||
      utcCheck.getUTCDate() !== day
    ) {
      return false;
    }
    return true;
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed);
}

function isUserAdmin(user: any): boolean {
  return hasAdminPermission(user?.role, 'users.manage');
}

// 1. Get All Users (Admin Only - Requires users.manage)
userRouter.get('/', requireAdminPermission('users.manage'), async (req, res) => {
  try {
    const rawUsers = await UserRepository.getAllAsync();
    const users = rawUsers.map(u => {
      const { passwordHash, salt, password, ...safe } = u;
      safe.permissions = getPermissionsForRole(u.role);
      return safe;
    });
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching users' });
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
    const { job } = req.body || {};
    const currentUserId = req.user?.userId || req.user?.id;
    const cleanId = typeof job?.id === 'string' ? job.id.trim() : '';
    if (!currentUserId || !job || typeof job !== 'object' || Array.isArray(job) || !cleanId || cleanId.length > 128) {
      return res.status(400).json({ success: false, message: 'Valid user session and job with id are required.' });
    }

    const ALLOWED_STRING_FIELDS = [
      'title',
      'company',
      'city',
      'province',
      'region',
      'jobType',
      'salary',
      'currency',
      'experienceLevel',
      'department',
      'postedAt',
      'deadline',
      'deadlineDate',
      'slug',
      'sourceUrl',
      'originalApplyUrl',
      'govtScale'
    ] as const;

    const safeJob: Record<string, any> = { id: cleanId };
    for (const field of ALLOWED_STRING_FIELDS) {
      const val = job[field];
      if (typeof val === 'string') {
        safeJob[field] = val.trim().slice(0, 300);
      } else if (typeof val === 'number' && Number.isFinite(val)) {
        safeJob[field] = String(val).slice(0, 300);
      }
    }

    if (typeof job.isGovtJob === 'boolean') {
      safeJob.isGovtJob = job.isGovtJob;
    }

    const result = Database.toggleSavedJob(currentUserId, safeJob);
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

    const userAlerts = Database.getJobAlerts(targetUserId);
    const deleted = userAlerts.some(a => a.id === req.params.id)
      ? Database.deleteJobAlert(req.params.id, targetUserId)
      : false;
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
    const { title, type, fileUrl, fileSize, fileName } = req.body || {};
    const currentUserId = req.user?.userId || req.user?.id;
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    if (!currentUserId || !cleanTitle || cleanTitle.length > 200 || cleanTitle.includes('\0')) {
      return res.status(400).json({ success: false, message: 'Valid user session and title are required.' });
    }

    let safeType = 'CV';
    if (type !== undefined && type !== null && type !== '') {
      if (typeof type !== 'string' || type.trim().length === 0 || type.trim().length > 100 || type.includes('\0')) {
        return res.status(400).json({ success: false, message: 'Invalid document type.' });
      }
      safeType = type.trim();
    }

    // Validate fileUrl: must be a non-empty string without traversal or unsafe schemes
    if (typeof fileUrl !== 'string' || !fileUrl.trim() || fileUrl.trim().length > 2048) {
      return res.status(400).json({ success: false, message: 'A valid document fileUrl is required.' });
    }
    const rawUrl = fileUrl.trim();
    if (
      rawUrl.includes('\0') ||
      rawUrl.includes('\\') ||
      rawUrl.includes('..') ||
      /%(2e|2f|5c)/i.test(rawUrl)
    ) {
      return res.status(400).json({ success: false, message: 'Invalid document fileUrl.' });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl, 'http://localhost');
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid document fileUrl.' });
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ success: false, message: 'Invalid document fileUrl protocol.' });
    }

    const pathname = parsedUrl.pathname;
    const isInternalPath = rawUrl.startsWith('/api/applications/cv/');

    let safeFileUrl = rawUrl;
    if (isInternalPath) {
      const prefix = '/api/applications/cv/';
      if (!pathname.startsWith(prefix)) {
        return res.status(400).json({ success: false, message: 'Invalid internal document fileUrl.' });
      }
      const rawSegment = pathname.slice(prefix.length);
      let decodedSegment = '';
      try {
        decodedSegment = decodeURIComponent(rawSegment);
      } catch {
        return res.status(400).json({ success: false, message: 'Invalid internal document fileUrl.' });
      }
      const baseSegment = path.basename(decodedSegment);
      if (
        !baseSegment ||
        baseSegment !== decodedSegment ||
        baseSegment !== rawSegment ||
        baseSegment === '.' ||
        baseSegment === '..' ||
        baseSegment.includes('/') ||
        baseSegment.includes('\\') ||
        baseSegment.includes('..')
      ) {
        return res.status(400).json({ success: false, message: 'Invalid internal document file path.' });
      }
      safeFileUrl = rawUrl;
    } else if (!/^https?:\/\//i.test(rawUrl)) {
      return res.status(400).json({ success: false, message: 'Invalid document fileUrl.' });
    }

    // Validate fileName when supplied
    let safeFileName: string | undefined = undefined;
    if (fileName !== undefined && fileName !== null) {
      if (
        typeof fileName !== 'string' ||
        !fileName.trim() ||
        fileName.trim().length > 255 ||
        fileName.includes('\0') ||
        fileName.includes('/') ||
        fileName.includes('\\') ||
        fileName.includes('..') ||
        /%(2e|2f|5c)/i.test(fileName)
      ) {
        return res.status(400).json({ success: false, message: 'Invalid fileName.' });
      }
      const trimmedFileName = fileName.trim();
      if (path.basename(trimmedFileName) !== trimmedFileName || trimmedFileName === '.' || trimmedFileName === '..') {
        return res.status(400).json({ success: false, message: 'Invalid fileName.' });
      }
      safeFileName = trimmedFileName;
    }

    // Validate fileSize when supplied (finite, non-negative, max 5MB = 5 * 1024 * 1024 bytes)
    const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;
    let safeFileSize: number | undefined = undefined;
    if (fileSize !== undefined && fileSize !== null && fileSize !== '') {
      const numericSize = Number(fileSize);
      if (!Number.isFinite(numericSize) || numericSize < 0 || numericSize > MAX_DOCUMENT_SIZE) {
        return res.status(400).json({
          success: false,
          message: 'Invalid fileSize. File size must be between 0 and 5MB.'
        });
      }
      safeFileSize = numericSize;
    }

    const doc = Database.addUserDocument({
      userId: currentUserId,
      title: cleanTitle,
      type: safeType,
      fileUrl: safeFileUrl,
      ...(safeFileSize !== undefined ? { fileSize: safeFileSize } : {}),
      ...(safeFileName !== undefined ? { fileName: safeFileName } : {})
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
    const userDocs = Database.getUserDocuments(targetUserId);
    const deleted = userDocs.some(d => d.id === req.params.id)
      ? Database.deleteUserDocument(req.params.id, targetUserId)
      : false;
    res.json({ success: deleted, message: deleted ? 'Document removed.' : 'Document not found.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error deleting document' });
  }
});

// 2. Get User Wallet Summary (Strictly authorization protected)
userRouter.get('/:id/wallet', requireAuth, async (req: any, res) => {
  try {
    const canViewWallet =
      hasAdminPermission(req.user?.role, 'users.manage') ||
      hasAdminPermission(req.user?.role, 'payments.manage') ||
      hasAdminPermission(req.user?.role, 'finance.manage');
    const currentUserId = req.user?.userId || req.user?.id;

    if (!canViewWallet && req.params.id !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only view your own wallet.' });
    }

    const summary = await PaymentRepository.getUserWalletAsync(req.params.id);
    res.json({ success: true, wallet: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching user wallet' });
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

// 6. Update User Profile or Admin Status
userRouter.put('/:id', requireAuth, async (req: any, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!isValidUserIdParam(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const updates = req.body;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ success: false, message: 'Invalid update payload.' });
    }

    const isAdmin = isUserAdmin(req.user);
    const currentUserId = String(req.user?.userId || req.user?.id || '').trim();

    let finalUpdates: Record<string, any>;

    if (!isAdmin) {
      if (id !== currentUserId) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only edit your own profile.' });
      }

      // Explicit allowlist of profile fields a normal user is permitted to self-update.
      // Strictly prevents modification of: role, walletBalance, membershipStatus, permissions,
      // plan, verified, kycStatus, activationDate, expiryDate, and administrative fields.
      finalUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        if (ALLOWED_NORMAL_USER_FIELDS.has(key)) {
          finalUpdates[key] = value;
        }
      }
    } else {
      const updateEntries = Object.entries(updates);
      if (updateEntries.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid update fields provided.' });
      }

      finalUpdates = {};
      for (const [key, value] of updateEntries) {
        if (PROTECTED_ADMIN_UPDATE_FIELDS.has(key)) {
          return res.status(400).json({
            success: false,
            message: `Protected field '${key}' cannot be modified via this endpoint.`
          });
        }
        if (!ALLOWED_ADMIN_USER_FIELDS.has(key)) {
          return res.status(400).json({
            success: false,
            message: `Unsupported field '${key}' in admin user update payload.`
          });
        }

        if (key === 'plan') {
          if (typeof value !== 'string' || !VALID_USER_PLANS.has(value)) {
            return res.status(400).json({ success: false, message: "Invalid plan value. Must be 'Free' or 'Premium'." });
          }
          finalUpdates[key] = value;
        } else if (key === 'membershipStatus') {
          if (typeof value !== 'string' || !VALID_MEMBERSHIP_STATUSES.has(value)) {
            return res.status(400).json({
              success: false,
              message: "Invalid membershipStatus value. Must be 'Active', 'Revoked', 'Expired', or 'Unpaid'."
            });
          }
          finalUpdates[key] = value;
        } else if (key === 'paymentStatus') {
          if (typeof value !== 'string' || !VALID_PAYMENT_STATUSES.has(value)) {
            return res.status(400).json({
              success: false,
              message: "Invalid paymentStatus value. Must be 'Paid', 'Unpaid', or 'Overdue'."
            });
          }
          finalUpdates[key] = value;
        } else if (key === 'autoRenew' || key === 'notificationsEnabled' || key === 'whatsappAlertsEnabled') {
          if (typeof value !== 'boolean') {
            return res.status(400).json({ success: false, message: `Field '${key}' must be a boolean.` });
          }
          finalUpdates[key] = value;
        } else if (key === 'expiryDate' || key === 'activationDate') {
          if (!isValidUserDateString(value)) {
            return res.status(400).json({ success: false, message: `Field '${key}' must be a valid date string.` });
          }
          finalUpdates[key] = value.trim();
        } else if (key === 'renewalCount') {
          if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100000) {
            return res.status(400).json({
              success: false,
              message: "Field 'renewalCount' must be a non-negative integer."
            });
          }
          finalUpdates[key] = value;
        } else if (key === 'adminNotes') {
          if (typeof value !== 'string' || value.length > 5000) {
            return res.status(400).json({
              success: false,
              message: "Field 'adminNotes' must be a string (max 5000 chars)."
            });
          }
          finalUpdates[key] = value;
        } else if (key === 'verificationStatus' || key === 'kycStatus') {
          if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
            return res.status(400).json({
              success: false,
              message: `Field '${key}' must be a non-empty string.`
            });
          }
          finalUpdates[key] = value.trim();
        } else if (key === 'skills') {
          if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
            return res.status(400).json({ success: false, message: "Field 'skills' must be an array of strings." });
          }
          finalUpdates[key] = value;
        } else if (key === 'preferences' || key === 'socialLinks') {
          if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return res.status(400).json({ success: false, message: `Field '${key}' must be an object.` });
          }
          finalUpdates[key] = value;
        } else if (key === 'experience' || key === 'education') {
          if (typeof value !== 'string' && !Array.isArray(value)) {
            return res.status(400).json({ success: false, message: `Field '${key}' must be a string or array.` });
          }
          finalUpdates[key] = value;
        } else {
          if (typeof value !== 'string' || value.length > 2000) {
            return res.status(400).json({ success: false, message: `Field '${key}' must be a valid string.` });
          }
          finalUpdates[key] = value;
        }
      }

      const existingUser = await UserRepository.getByIdAsync(id);
      if (!existingUser) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      if (existingUser.role === 'Super Admin' && req.user?.role !== 'Super Admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Only a Super Admin can modify a Super Admin account.'
        });
      }
    }

    // Defensive safeguard: never allow updating passwordHash, salt, password, role, permissions, walletBalance, or primary ID
    delete finalUpdates.passwordHash;
    delete finalUpdates.salt;
    delete finalUpdates.password;
    delete finalUpdates.id;
    delete finalUpdates._id;
    delete finalUpdates.role;
    delete finalUpdates.permissions;
    delete finalUpdates.walletBalance;

    const updated = await UserRepository.updateAsync(id, finalUpdates);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (isAdmin) {
      const membershipChanged = ['plan', 'membershipStatus', 'paymentStatus', 'autoRenew', 'expiryDate', 'activationDate', 'renewalCount']
        .some(field => Object.prototype.hasOwnProperty.call(finalUpdates, field));
      try {
        AuditRepository.add({
          user: req.user?.name || req.user?.email || 'Administrator',
          role: req.user?.role || 'Admin',
          action: membershipChanged ? 'Admin User Membership Updated' : 'Admin User Profile Updated',
          target: `${updated.email || updated.id} (${updated.id})`,
          status: 'Success',
          metadata: {
            actorId: currentUserId,
            targetUserId: updated.id,
            updatedFields: Object.keys(finalUpdates),
            plan: updated.plan,
            membershipStatus: updated.membershipStatus,
            paymentStatus: updated.paymentStatus,
            expiryDate: updated.expiryDate
          }
        });
      } catch (auditErr) {
        console.warn('[userRoutes] Failed to log user update audit entry:', auditErr);
      }
    }

    const { passwordHash, salt, password, ...safeUser } = updated;
    res.json({ success: true, user: safeUser, message: 'User profile updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating user' });
  }
});

// 7. Permanently Delete User Account (Admin Only - Requires users.manage, Non-Cascading)
userRouter.delete('/:id', requireAdminPermission('users.manage'), async (req: any, res) => {
  try {
    const targetId = String(req.params.id || '').trim();
    if (!isValidUserIdParam(targetId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID.' });
    }

    const actorId = String(req.user?.userId || req.user?.id || '').trim();
    if (actorId && targetId === actorId) {
      return res.status(403).json({
        success: false,
        message: 'Action blocked: You cannot delete your own account.'
      });
    }

    const targetUser = await UserRepository.getByIdAsync(targetId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (targetUser.role === 'Super Admin' && req.user?.role !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Only a Super Admin can delete a Super Admin account.'
      });
    }

    if (
      targetUser.isSystem === true ||
      targetUser.isProtected === true ||
      targetUser.isBootstrapAdmin === true ||
      PROTECTED_SYSTEM_ACCOUNT_IDS.has(targetId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Action blocked: Protected administrative or system accounts cannot be deleted.'
      });
    }

    if (targetUser.role === 'Super Admin') {
      const allUsers = await UserRepository.getAllAsync();
      const superAdminCount = allUsers.filter(u => u && u.role === 'Super Admin').length;
      if (superAdminCount <= 1) {
        return res.status(403).json({
          success: false,
          message: 'Action blocked: Cannot delete the last remaining Super Admin account.'
        });
      }
    }

    const deleted = await UserRepository.deleteAsync(targetId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'User not found or already deleted.' });
    }

    try {
      AuditRepository.add({
        user: req.user?.name || req.user?.email || 'Administrator',
        role: req.user?.role || 'Admin',
        action: 'User Account Deleted',
        target: `${targetUser.email || targetId} (${targetId})`,
        status: 'Success',
        metadata: {
          actorId,
          targetUserId: targetId,
          targetRole: targetUser.role
        }
      });
    } catch (auditErr) {
      console.warn('[userRoutes] Failed to log user deletion audit entry:', auditErr);
    }

    return res.json({
      success: true,
      deletedId: targetId,
      message: 'User account permanently deleted.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error deleting user' });
  }
});
