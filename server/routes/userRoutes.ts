import { Router } from 'express';
import { Database } from '../db/database';
import { PaymentRepository, UserRepository } from '../db/repositories';
import { requireAdmin, requireAuth } from '../auth/authManager';

export const userRouter = Router();

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


// 2. Get User Wallet Summary
userRouter.get('/:id/wallet', (req, res) => {
  try {
    const summary = PaymentRepository.getUserWallet(req.params.id);
    res.json({ success: true, wallet: summary });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching user wallet' });
  }
});

// 3. User Saved Jobs
userRouter.get('/saved-jobs', (req, res) => {
  try {
    const userId = (req.query.userId as string) || (req as any).user?.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId query parameter is required.' });
    }
    const saved = Database.getSavedJobs(userId);
    res.json({ success: true, savedJobs: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching saved jobs' });
  }
});

userRouter.post('/saved-jobs/toggle', (req, res) => {
  try {
    const { userId, job } = req.body;
    const targetUserId = userId || (req as any).user?.userId;
    if (!targetUserId || !job?.id) {
      return res.status(400).json({ success: false, message: 'userId and job with id are required.' });
    }
    const result = Database.toggleSavedJob(targetUserId, job);
    res.json({ success: true, saved: result.saved, count: result.count });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error toggling saved job' });
  }
});

// 4. User Job Alerts
userRouter.get('/job-alerts', (req, res) => {
  try {
    const userId = (req.query.userId as string) || (req as any).user?.userId;
    const alerts = Database.getJobAlerts(userId);
    res.json({ success: true, alerts });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching alerts' });
  }
});

userRouter.post('/job-alerts', (req, res) => {
  try {
    const { userId, keyword, city, jobType, frequency, email } = req.body;
    const targetUserId = userId || (req as any).user?.userId;
    if (!keyword && !city && !jobType) {
      return res.status(400).json({ success: false, message: 'At least one filter criteria (keyword, city, jobType) is required.' });
    }
    const newAlert = Database.addJobAlert({
      userId: targetUserId || 'anonymous',
      keyword,
      city,
      jobType,
      frequency: frequency || 'daily',
      email
    });
    res.status(201).json({ success: true, alert: newAlert, message: 'Job alert created successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error creating job alert' });
  }
});

userRouter.delete('/job-alerts/:id', (req, res) => {
  try {
    const userId = (req.query.userId as string) || (req as any).user?.userId;
    const deleted = Database.deleteJobAlert(req.params.id, userId);
    res.json({ success: deleted, message: deleted ? 'Alert removed.' : 'Alert not found.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error deleting job alert' });
  }
});

// 5. User Documents (CVs & Portfolios)
userRouter.get('/documents', (req, res) => {
  try {
    const userId = (req.query.userId as string) || (req as any).user?.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }
    const docs = Database.getUserDocuments(userId);
    res.json({ success: true, documents: docs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching documents' });
  }
});

userRouter.post('/documents', (req, res) => {
  try {
    const { userId, title, type, fileUrl, fileSize, fileName } = req.body;
    const targetUserId = userId || (req as any).user?.userId;
    if (!targetUserId || !title) {
      return res.status(400).json({ success: false, message: 'userId and title are required.' });
    }
    const doc = Database.addUserDocument({
      userId: targetUserId,
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

userRouter.delete('/documents/:id', (req, res) => {
  try {
    const userId = (req.query.userId as string) || (req as any).user?.userId;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required.' });
    }
    const deleted = Database.deleteUserDocument(req.params.id, userId);
    res.json({ success: deleted, message: deleted ? 'Document removed.' : 'Document not found.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error deleting document' });
  }
});

// 6. Update User Profile or Admin Status
userRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Do not allow updating passwordHash directly via this endpoint
    delete updates.passwordHash;
    delete updates.salt;

    const updated = UserRepository.update(id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const { passwordHash, salt, password, ...safeUser } = updated;
    res.json({ success: true, user: safeUser, message: 'User profile updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating user' });
  }
});


