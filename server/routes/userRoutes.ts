import { Router } from 'express';
import path from 'path';
import { Database } from '../db/database';
import { AuditRepository, PaymentRepository, PricingRepository, UserRepository } from '../db/repositories';
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
  'cvData',
  'cvDocuments',
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
  'walletEscrowBalance',
  'walletEscrowOperations',
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

function validateCvDataPayload(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'CV data must be a valid object.';
  }

  let serialized = '';
  try {
    const serializedValue = JSON.stringify(value);
    if (typeof serializedValue !== 'string') {
      return 'CV data could not be serialized.';
    }
    serialized = serializedValue;
  } catch {
    return 'CV data could not be serialized.';
  }
  if (serialized.length > 500000) {
    return 'CV data is too large. Please reduce the content or remove the embedded profile photo.';
  }

  const data = value as Record<string, any>;
  const personalInfo = data.personalInfo;
  if (!personalInfo || typeof personalInfo !== 'object' || Array.isArray(personalInfo)) {
    return 'CV personal information is required.';
  }

  const personalFields = ['fullName', 'jobTitle', 'email', 'phone', 'location', 'website', 'linkedin', 'github', 'summary'];
  for (const field of personalFields) {
    if (typeof personalInfo[field] !== 'string' || personalInfo[field].length > 5000) {
      return `CV personal field '${field}' must be text with a maximum of 5000 characters.`;
    }
  }

  if (!Array.isArray(data.experience) || data.experience.length > 50) {
    return 'CV experience must be an array with no more than 50 entries.';
  }
  for (const item of data.experience) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
      !['id', 'company', 'position', 'location', 'startDate', 'endDate'].every((key) => typeof item[key] === 'string' && item[key].length <= 500) ||
      typeof item.current !== 'boolean' || !Array.isArray(item.bullets) || item.bullets.length > 30 ||
      item.bullets.some((bullet: unknown) => typeof bullet !== 'string' || bullet.length > 3000)) {
      return 'One or more CV experience entries are invalid.';
    }
  }

  if (!Array.isArray(data.education) || data.education.length > 50) {
    return 'CV education must be an array with no more than 50 entries.';
  }
  for (const item of data.education) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
      !['id', 'institution', 'degree', 'fieldOfStudy', 'startDate', 'endDate'].every((key) => typeof item[key] === 'string' && item[key].length <= 500) ||
      (item.gpa !== undefined && (typeof item.gpa !== 'string' || item.gpa.length > 100))) {
      return 'One or more CV education entries are invalid.';
    }
  }

  const skills = data.skills;
  if (!skills || typeof skills !== 'object' || Array.isArray(skills)) {
    return 'CV skills must be provided as an object.';
  }
  for (const field of ['technical', 'soft', 'languages']) {
    if (!Array.isArray(skills[field]) || skills[field].length > 100 ||
      skills[field].some((item: unknown) => typeof item !== 'string' || item.length > 200)) {
      return `CV skills field '${field}' must be an array of short text values.`;
    }
  }

  if (!Array.isArray(data.certifications) || data.certifications.length > 50) {
    return 'CV certifications must be an array with no more than 50 entries.';
  }
  for (const item of data.certifications) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
      !['id', 'name', 'issuer', 'year'].every((key) => typeof item[key] === 'string' && item[key].length <= 500)) {
      return 'One or more CV certification entries are invalid.';
    }
  }

  if (data.additionalSections !== undefined) {
    const extra = data.additionalSections;
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return 'CV additional sections must be an object.';
    const textFields = ['objective', 'careerGapExplanation', 'preferredEmploymentType', 'noticePeriod', 'domicile', 'professionalRegistration'];
    for (const field of textFields) {
      if (extra[field] !== undefined && (typeof extra[field] !== 'string' || extra[field].length > 5000)) return `CV additional field '${field}' must be text with a maximum of 5000 characters.`;
    }
    const listFields = ['projects', 'internships', 'volunteerWork', 'achievements', 'professionalTraining', 'relevantCoursework', 'publications', 'references'];
    for (const field of listFields) {
      if (extra[field] !== undefined && (!Array.isArray(extra[field]) || extra[field].length > 50 ||
        extra[field].some((item: unknown) => typeof item !== 'string' || item.length > 2000))) return `CV additional field '${field}' must contain no more than 50 text entries (2000 characters each).`;
    }
  }

  if (!['modern', 'executive', 'tech', 'classic', 'ats'].includes(data.templateStyle)) {
    return 'CV template style is invalid.';
  }
  if (typeof data.themeColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(data.themeColor)) {
    return 'CV theme color must be a valid six-digit hex color.';
  }
  if (data.photoBase64 !== undefined &&
    (typeof data.photoBase64 !== 'string' || data.photoBase64.length > 400000 ||
      !/^data:image\/(png|jpeg|webp);base64,/i.test(data.photoBase64))) {
    return 'CV profile photo must be a PNG, JPEG, or WebP image within the supported size limit.';
  }

  return null;
}

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

// CV export/share authorization. Quota is consumed server-side before the client starts the action.
userRouter.post('/cv/consume', requireAuth, async (req: any, res) => {
  try {
    const userId = String(req.user?.userId || req.user?.id || '').trim();
    const action = String(req.body?.action || '').trim();
    const templateId = String(req.body?.templateId || '').trim();
    const usageField = action === 'pdf' ? 'pdfExportLimit' : action === 'ats' ? 'atsExportLimit' : action === 'share' ? 'shareLimit' : '';
    if (!userId || !usageField || !templateId || templateId.length > 80) {
      return res.status(400).json({ success: false, message: 'A valid CV action and template are required.' });
    }
    const user = await UserRepository.getByIdAsync(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User account not found.' });
    const pricing = (await PricingRepository.get()) || {};
    const settings = pricing.cvBuilder || {};
    const templates = Array.isArray(settings.templates) ? settings.templates : [];
    const template = templates.find((item: any) => String(item?.id || '') === templateId);
    if (!template || template.enabled === false) return res.status(403).json({ success: false, message: 'This CV design is not currently available.' });
    if (action === 'pdf' && (settings.pdfExportEnabled === false || template.pdfExportEnabled === false)) {
      return res.status(403).json({ success: false, message: 'PDF export is disabled by the administrator for this CV design.' });
    }
    if (action === 'ats' && (settings.atsTextExportEnabled === false || template.atsExportEnabled === false)) {
      return res.status(403).json({ success: false, message: 'ATS text export is disabled by the administrator for this CV design.' });
    }
    const inactive = new Set(['Inactive', 'Expired', 'Suspended', 'Cancelled', 'Revoked']);
    const premium = !inactive.has(String(user.membershipStatus || '')) && (
      (user.membershipStatus === 'Active' && Boolean(user.membershipTier) && String(user.membershipTier).toLowerCase() !== 'free') ||
      user.plan === 'Premium' ||
      (user.paymentStatus === 'Paid' && user.membershipStatus === 'Active')
    );
    const activeGrants = (Array.isArray(user.cvPackageEntitlements) ? user.cvPackageEntitlements : [])
      .filter((item: any) => Date.parse(String(item?.expiresAt || '')) > Date.now())
      .sort((a: any, b: any) => Date.parse(String(a.expiresAt)) - Date.parse(String(b.expiresAt)));
    if (activeGrants.length) {
      for (const grant of activeGrants) {
        const limit = Number(grant?.limits?.[usageField] || 0);
        const used = Number(grant?.usage?.[usageField] || 0);
        if (limit <= used) continue;
        const updated = await UserRepository.consumeCvPackageQuotaAsync(userId, String(grant.transactionId), usageField as any, limit);
        if (updated) {
          return res.json({
            success: true,
            action,
            remaining: Math.max(0, limit - used - 1),
            packageName: grant.packageName,
            packageExpiresAt: grant.expiresAt,
            noWatermark: grant.noWatermark === true || settings.watermarkEnabled === false || (premium && settings.watermarkFreeOnly !== false)
          });
        }
      }
      return res.status(403).json({ success: false, message: 'Your active CV package has no remaining quota for this action.' });
    }
    return res.json({
      success: true,
      action,
      remaining: null,
      noWatermark: settings.watermarkEnabled === false || (premium && settings.watermarkFreeOnly !== false)
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Unable to authorize CV action.' });
  }
});

// 1. Get All Users (Admin Only - Requires users.manage)
userRouter.get('/', requireAdminPermission('users.manage'), async (req, res) => {
  try {
    const rawUsers = await UserRepository.getAllAsync();
    const users = rawUsers.map(u => {
      // CV drafts are private user content; do not bulk-include them in the admin user directory payload.
      const safe = { ...u };
      delete safe.passwordHash;
      delete safe.salt;
      delete safe.password;
      delete safe.cvData;
      delete safe.cvDocuments;
      delete safe.walletEscrowOperations;
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

    const { passwordHash, salt, password, cvData, cvDocuments, ...safeUser } = user;
    delete safeUser.walletEscrowOperations;
    // CV drafts and saved CV documents are private to their owner, not exposed to administrators viewing another account.
    if (String(id) === String(currentUserId)) {
      if (cvData !== undefined) safeUser.cvData = cvData;
      if (cvDocuments !== undefined) safeUser.cvDocuments = cvDocuments;
    }
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
      // Strictly prevents modification of: role, wallet balances/escrow ledger, membershipStatus, permissions,
      // plan, verified, kycStatus, activationDate, expiryDate, and administrative fields.
      finalUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        if (ALLOWED_NORMAL_USER_FIELDS.has(key)) {
          finalUpdates[key] = value;
        }
      }

      // Validate the owner's CV draft in the self-service branch as well as the admin branch.
      if (Object.prototype.hasOwnProperty.call(finalUpdates, 'cvData')) {
        const cvDataError = validateCvDataPayload(finalUpdates.cvData);
        if (cvDataError) {
          return res.status(400).json({ success: false, message: cvDataError });
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
        if (id !== currentUserId && (key === 'cvData' || key === 'cvDocuments')) {
          return res.status(403).json({ success: false, message: 'CV content is private and can only be changed by its owner.' });
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
        } else if (key === 'cvData') {
          const cvDataError = validateCvDataPayload(value);
          if (cvDataError) {
            return res.status(400).json({ success: false, message: cvDataError });
          }
          finalUpdates[key] = value;
        } else if (key === 'cvDocuments') {
          if (!Array.isArray(value) || value.length > 10) return res.status(400).json({ success: false, message: 'CV documents must be an array with no more than 10 entries.' });
          finalUpdates[key] = value;
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

    if (Object.prototype.hasOwnProperty.call(finalUpdates, 'cvDocuments') || Object.prototype.hasOwnProperty.call(finalUpdates, 'cvData')) {
      const cvOwner = await UserRepository.getByIdAsync(id);
      if (!cvOwner) return res.status(404).json({ success: false, message: 'User not found.' });
      const documents = Object.prototype.hasOwnProperty.call(finalUpdates, 'cvDocuments') ? finalUpdates.cvDocuments : [];
      if (Object.prototype.hasOwnProperty.call(finalUpdates, 'cvDocuments') && (!Array.isArray(documents) || documents.length > 10)) return res.status(400).json({ success: false, message: 'CV documents must be an array with no more than 10 entries.' });
      const seenIds = new Set<string>();
      for (const document of documents) {
        if (!document || typeof document !== 'object' || Array.isArray(document) ||
          typeof document.id !== 'string' || !document.id.trim() || document.id.length > 100 ||
          typeof document.title !== 'string' || document.title.length > 120 ||
          typeof document.updatedAt !== 'string' || document.updatedAt.length > 50 ||
          seenIds.has(document.id)) {
          return res.status(400).json({ success: false, message: 'One or more saved CV document records are invalid.' });
        }
        seenIds.add(document.id);
        const documentError = validateCvDataPayload(document.data);
        if (documentError) return res.status(400).json({ success: false, message: documentError });
      }
      if (!isAdmin) {
        const pricing = await PricingRepository.get();
        const cvTemplates = Array.isArray(pricing?.cvBuilder?.templates) ? pricing.cvBuilder.templates : [];
        const freeDesignLimit = Math.min(5, Math.max(0, Math.floor(Number(pricing?.cvBuilder?.freeDesignLimit ?? 2))));
        const freeTemplateIds = new Set(cvTemplates
          .filter((item: any) => item && item.enabled !== false && item.free === true)
          .slice(0, freeDesignLimit)
          .map((item: any) => String(item.id)));
        const purchasedTemplateIds = new Set((Array.isArray(cvOwner.cvDesignEntitlements) ? cvOwner.cvDesignEntitlements : [])
          .map((item: any) => String(item?.templateId || '')));
        const membershipStatusForAccess = String(cvOwner.membershipStatus || '').trim();
        const membershipTierForAccess = String(cvOwner.membershipTier || '').trim();
        const inactiveStatusesForAccess = new Set(['Inactive', 'Expired', 'Suspended', 'Cancelled']);
        const premiumAccess = !inactiveStatusesForAccess.has(membershipStatusForAccess) && (
          (membershipStatusForAccess === 'Active' && Boolean(membershipTierForAccess) && membershipTierForAccess.toLowerCase() !== 'free') ||
          cvOwner.plan === 'Premium' ||
          (cvOwner.paymentStatus === 'Paid' && membershipStatusForAccess === 'Active')
        );
        const candidateCvPayloads = [
          ...(Object.prototype.hasOwnProperty.call(finalUpdates, 'cvData') ? [finalUpdates.cvData] : []),
          ...(Array.isArray(documents) ? documents.map((document: any) => document.data) : [])
        ];
        for (const cvPayload of candidateCvPayloads) {
          const templateId = String(cvPayload?.templateStyle || '');
          const template = cvTemplates.find((item: any) => String(item?.id || '') === templateId);
          if (!template || (template.enabled === false && !purchasedTemplateIds.has(templateId))) {
            return res.status(403).json({ success: false, message: 'This CV design is not currently available.' });
          }
          if (!premiumAccess && !freeTemplateIds.has(templateId) && !purchasedTemplateIds.has(templateId)) {
            return res.status(403).json({ success: false, message: 'Purchase this Premium CV design or activate a Premium membership before saving it.' });
          }
        }
        const freeLimit = Math.min(10, Math.max(0, Math.floor(Number(pricing?.cvBuilder?.freeCvLimit ?? 1))));
        const premiumLimit = Math.min(10, Math.max(1, Math.floor(Number(pricing?.cvBuilder?.premiumCvLimit ?? 10))));
        const membershipStatus = String(cvOwner.membershipStatus || '').trim();
        const membershipTier = String(cvOwner.membershipTier || '').trim();
        const inactiveStatuses = new Set(['Inactive', 'Expired', 'Suspended', 'Cancelled']);
        const premiumActive = !inactiveStatuses.has(membershipStatus) && (
          (membershipStatus === 'Active' && Boolean(membershipTier) && membershipTier.toLowerCase() !== 'free') ||
          cvOwner.plan === 'Premium' ||
          (cvOwner.paymentStatus === 'Paid' && membershipStatus === 'Active')
        );
        const maxAllowed = premiumActive ? premiumLimit : freeLimit;
        const existingIds = new Set((Array.isArray(cvOwner.cvDocuments) ? cvOwner.cvDocuments : []).map((item: any) => String(item?.id || '')));
        const addsNewDocument = Array.isArray(documents) && documents.some((document: any) => !existingIds.has(document.id));
        if (Array.isArray(documents) && documents.length > maxAllowed && addsNewDocument) {
          return res.status(403).json({ success: false, message: `Your current CV limit is ${maxAllowed}. Upgrade your plan or contact the administrator to increase it.` });
        }
      }
      if (Object.prototype.hasOwnProperty.call(finalUpdates, 'cvDocuments')) finalUpdates.cvDocuments = documents;
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
    delete finalUpdates.walletEscrowBalance;
    delete finalUpdates.walletEscrowOperations;

    let updated: any = null;
    if (!isAdmin && Array.isArray(finalUpdates.cvDocuments)) {
      const cvOwner = await UserRepository.getByIdAsync(id);
      if (!cvOwner) return res.status(404).json({ success: false, message: 'User not found.' });
      const previousDocs = Array.isArray(cvOwner.cvDocuments) ? cvOwner.cvDocuments : [];
      const previousById = new Map(previousDocs.map((item: any) => [String(item?.id || ''), item]));
      const incomingDocs = finalUpdates.cvDocuments;
      const createCount = incomingDocs.filter((item: any) => !previousById.has(String(item.id))).length;
      const editCount = incomingDocs.filter((item: any) => {
        const previous: any = previousById.get(String(item.id));
        return Boolean(previous) && (String(previous.title || '') !== String(item.title || '') ||
          JSON.stringify(previous.data) !== JSON.stringify(item.data));
      }).length;
      const activeGrants = (Array.isArray(cvOwner.cvPackageEntitlements) ? cvOwner.cvPackageEntitlements : [])
        .filter((item: any) => Date.parse(String(item?.expiresAt || '')) > Date.now())
        .sort((a: any, b: any) => Date.parse(String(a.expiresAt)) - Date.parse(String(b.expiresAt)));
      if (activeGrants.length && (createCount > 0 || editCount > 0)) {
        const grant = activeGrants.find((item: any) => {
          const createRemaining = Math.max(0, Number(item?.limits?.cvCreateLimit || 0) - Number(item?.usage?.cvCreateLimit || 0));
          const editRemaining = Math.max(0, Number(item?.limits?.editLimit || 0) - Number(item?.usage?.editLimit || 0));
          return createCount <= createRemaining && editCount <= editRemaining;
        });
        if (!grant) {
          return res.status(403).json({
            success: false,
            message: 'Your active CV package does not have enough remaining CV creation or edit quota. Please purchase another package or wait for a valid renewal.'
          });
        }
        updated = await UserRepository.saveCvDocumentsWithPackageUsageAsync(
          id, incomingDocs, finalUpdates.cvData, String(grant.transactionId),
          createCount, editCount, Number(grant.limits?.cvCreateLimit || 0), Number(grant.limits?.editLimit || 0)
        );
        if (!updated) {
          return res.status(409).json({ success: false, message: 'CV package quota or account data changed during save. Please reload your CV and try again.' });
        }
        delete finalUpdates.cvDocuments;
        delete finalUpdates.cvData;
      }
    }
    if (!updated) updated = await UserRepository.updateAsync(id, finalUpdates);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let auditOutcome: { persisted: boolean; auditWarning?: string } | null = null;
    if (isAdmin) {
      const membershipChanged = ['plan', 'membershipStatus', 'paymentStatus', 'autoRenew', 'expiryDate', 'activationDate', 'renewalCount']
        .some(field => Object.prototype.hasOwnProperty.call(finalUpdates, field));
      auditOutcome = await AuditRepository.addAfterPrimaryOperation({
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
      }, 'PUT /api/users/:id');
    }

    const { passwordHash, salt, password, ...safeUser } = updated;
    res.json({
      success: true,
      user: safeUser,
      message: 'User profile updated successfully!',
      ...(auditOutcome && !auditOutcome.persisted
        ? { auditPersisted: false, auditWarning: auditOutcome.auditWarning }
        : {})
    });
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

    const auditOutcome = await AuditRepository.addAfterPrimaryOperation({
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
    }, 'DELETE /api/users/:id');

    return res.json({
      success: true,
      deletedId: targetId,
      message: 'User account permanently deleted.',
      ...(auditOutcome.persisted ? {} : { auditPersisted: false, auditWarning: auditOutcome.auditWarning })
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Error deleting user' });
  }
});
