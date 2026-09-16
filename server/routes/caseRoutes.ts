import { Router } from 'express';
import { CaseRepository, AuditRepository } from '../db/repositories';
import { requireAdmin, requireAuth } from '../auth/authManager';

export const caseRouter = Router();

// 1. Get cases (scoped to authenticated user, or all for admin)
caseRouter.get('/', requireAuth, async (req: any, res) => {
  try {
    const isAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin';
    const { type, status } = req.query as Record<string, string>;

    const queryUserId = req.query.userId as string | undefined;
    const targetUserId = isAdmin && queryUserId ? queryUserId : (req.user?.userId || req.user?.id);

    const cases = await CaseRepository.getAllAsync({
      type,
      status,
      userId: isAdmin && !queryUserId ? undefined : targetUserId
    });
    res.json({ success: true, cases });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching cases' });
  }
});

// 2. Get single case by ID or Case Number (strictly authorization-checked)
caseRouter.get('/:id', requireAuth, async (req: any, res) => {
  try {
    const found = await CaseRepository.getByIdAsync(req.params.id);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    const isAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin';
    const currentUserId = req.user?.userId || req.user?.id;

    if (!isAdmin && found.userId && found.userId !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only view your own cases.' });
    }

    res.json({ success: true, case: found });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching case' });
  }
});

// 3. Create a universal submission case
caseRouter.post('/', requireAuth, async (req: any, res) => {
  try {
    const { type, referenceId, title, priority, metadata } = req.body;
    if (!title || !type) {
      return res.status(400).json({ success: false, message: 'Title and type are required to create a case.' });
    }

    const isAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin';
    const currentUserId = req.user?.userId || req.user?.id;
    const targetUserId = isAdmin && req.body.userId ? req.body.userId : currentUserId;
    const targetUserName = isAdmin && req.body.userName ? req.body.userName : (req.user?.name || 'Member');
    const targetUserEmail = isAdmin && req.body.userEmail ? req.body.userEmail : (req.user?.email || '');

    const newCase = await CaseRepository.createAsync({
      type,
      referenceId,
      title,
      userId: targetUserId,
      userName: targetUserName,
      userEmail: targetUserEmail,
      priority: priority || 'medium',
      metadata
    });

    AuditRepository.add({
      user: targetUserName,
      role: req.user?.role || 'Member',
      action: 'Universal Case Created',
      target: `${newCase.caseNumber}: ${newCase.title}`,
      status: 'Success',
      metadata: { caseNumber: newCase.caseNumber, type: newCase.type }
    });

    res.status(201).json({ success: true, case: newCase });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error creating case' });
  }
});

// 4. Update case status (Admin only)
caseRouter.patch('/:id/status', requireAdmin, async (req: any, res) => {
  try {
    const { status, note, actor, role } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    const updated = await CaseRepository.updateStatusAsync(
      req.params.id,
      status,
      actor || req.user?.name || 'System Admin',
      role || req.user?.role || 'Super Admin',
      note
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    AuditRepository.add({
      user: actor || req.user?.name || 'Admin',
      role: role || req.user?.role || 'Super Admin',
      action: 'Case Status Transition',
      target: `${updated.caseNumber} -> ${status}`,
      status: 'Success',
      metadata: { caseNumber: updated.caseNumber, status, note }
    });

    res.json({ success: true, case: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating case status' });
  }
});

// 5. Add custom timeline event
caseRouter.post('/:id/timeline', requireAuth, async (req: any, res) => {
  try {
    const { action, note } = req.body;
    if (!action || !note) {
      return res.status(400).json({ success: false, message: 'Action and note are required.' });
    }

    const existing = await CaseRepository.getByIdAsync(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    const isAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin';
    const currentUserId = req.user?.userId || req.user?.id;

    if (!isAdmin && existing.userId && existing.userId !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only annotate your own cases.' });
    }

    const updated = await CaseRepository.addTimelineEventAsync(existing.id, {
      actor: req.user?.name || 'Member',
      role: req.user?.role || 'Member',
      action,
      note
    });

    res.json({ success: true, case: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error adding timeline event' });
  }
});

// 6. Request correction (Admin)
caseRouter.post('/:id/request-correction', requireAdmin, async (req: any, res) => {
  try {
    const { correctionNotes, actor, role } = req.body;
    if (!correctionNotes) {
      return res.status(400).json({ success: false, message: 'Correction instructions are required.' });
    }

    const updated = await CaseRepository.requestCorrectionAsync(
      req.params.id,
      actor || req.user?.name || 'Review Admin',
      role || req.user?.role || 'Super Admin',
      correctionNotes
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    res.json({ success: true, case: updated, message: 'Correction requested successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error requesting correction' });
  }
});

// 7. Submit dispute (Case Owner only or Admin)
caseRouter.post('/:id/dispute', requireAuth, async (req: any, res) => {
  try {
    const { disputeNotes } = req.body;
    if (!disputeNotes) {
      return res.status(400).json({ success: false, message: 'Dispute reasoning is required.' });
    }

    const existing = await CaseRepository.getByIdAsync(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    const isAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin';
    const currentUserId = req.user?.userId || req.user?.id;

    if (!isAdmin && existing.userId && existing.userId !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only dispute your own cases.' });
    }

    const updated = await CaseRepository.submitDisputeAsync(
      existing.id,
      req.user?.name || 'Member',
      req.user?.role || 'Member',
      disputeNotes
    );

    AuditRepository.add({
      user: req.user?.name || 'User',
      role: req.user?.role || 'Member',
      action: 'Case Disputed',
      target: `${updated?.caseNumber}`,
      status: 'Warning',
      metadata: { caseNumber: updated?.caseNumber, disputeNotes }
    });

    res.json({ success: true, case: updated, message: 'Dispute submitted for arbitration review.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error submitting dispute' });
  }
});

// 8. Resolve dispute (Admin)
caseRouter.post('/:id/resolve-dispute', requireAdmin, async (req: any, res) => {
  try {
    const { resolutionNotes, actor, role, newStatus } = req.body;
    if (!resolutionNotes) {
      return res.status(400).json({ success: false, message: 'Resolution notes are required.' });
    }

    const updated = await CaseRepository.resolveDisputeAsync(
      req.params.id,
      actor || req.user?.name || 'Senior Arbiter',
      role || req.user?.role || 'Super Admin',
      resolutionNotes,
      newStatus || 'resolved'
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    AuditRepository.add({
      user: actor || req.user?.name || 'Admin',
      role: role || req.user?.role || 'Super Admin',
      action: 'Dispute Resolved',
      target: `${updated.caseNumber} -> ${newStatus || 'resolved'}`,
      status: 'Success',
      metadata: { caseNumber: updated.caseNumber, resolutionNotes }
    });

    res.json({ success: true, case: updated, message: 'Dispute has been resolved.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error resolving dispute' });
  }
});
