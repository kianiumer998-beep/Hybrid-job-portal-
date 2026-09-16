import { Router } from 'express';
import { CaseRepository, AuditRepository } from '../db/repositories';
import { requireAdmin } from '../auth/authManager';

export const caseRouter = Router();

// 1. Get all cases (filter by type, status, userId)
caseRouter.get('/', async (req, res) => {
  try {
    const { type, status, userId } = req.query as Record<string, string>;
    const cases = await CaseRepository.getAllAsync({ type, status, userId });
    res.json({ success: true, cases });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching cases' });
  }
});

// 2. Get single case by ID or Case Number
caseRouter.get('/:id', async (req, res) => {
  try {
    const found = await CaseRepository.getByIdAsync(req.params.id);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }
    res.json({ success: true, case: found });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching case' });
  }
});


// 3. Create a universal submission case
caseRouter.post('/', (req, res) => {
  try {
    const { type, referenceId, title, userId, userName, userEmail, priority, metadata } = req.body;
    if (!title || !type) {
      return res.status(400).json({ success: false, message: 'Title and type are required to create a case.' });
    }

    const newCase = CaseRepository.create({
      type,
      referenceId,
      title,
      userId,
      userName,
      userEmail,
      priority: priority || 'medium',
      metadata
    });

    AuditRepository.add({
      user: userName || 'Member',
      role: 'Member',
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
caseRouter.patch('/:id/status', requireAdmin, (req, res) => {
  try {
    const { status, note, actor, role } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    const updated = CaseRepository.updateStatus(
      req.params.id,
      status,
      actor || 'System Admin',
      role || 'Super Admin',
      note
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    AuditRepository.add({
      user: actor || 'Admin',
      role: role || 'Super Admin',
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
caseRouter.post('/:id/timeline', (req, res) => {
  try {
    const { actor, role, action, note } = req.body;
    if (!action || !note) {
      return res.status(400).json({ success: false, message: 'Action and note are required.' });
    }

    const updated = CaseRepository.addTimelineEvent(req.params.id, {
      actor: actor || 'User',
      role: role || 'Member',
      action,
      note
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    res.json({ success: true, case: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error adding timeline event' });
  }
});

// 6. Request correction (Admin)
caseRouter.post('/:id/request-correction', requireAdmin, (req, res) => {
  try {
    const { correctionNotes, actor, role } = req.body;
    if (!correctionNotes) {
      return res.status(400).json({ success: false, message: 'Correction instructions are required.' });
    }

    const updated = CaseRepository.requestCorrection(
      req.params.id,
      actor || 'Review Admin',
      role || 'Super Admin',
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

// 7. Submit dispute (User or Employer)
caseRouter.post('/:id/dispute', (req, res) => {
  try {
    const { disputeNotes, actor, role } = req.body;
    if (!disputeNotes) {
      return res.status(400).json({ success: false, message: 'Dispute reasoning is required.' });
    }

    const updated = CaseRepository.submitDispute(
      req.params.id,
      actor || 'Member',
      role || 'Member',
      disputeNotes
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    AuditRepository.add({
      user: actor || 'User',
      role: role || 'Member',
      action: 'Case Disputed',
      target: `${updated.caseNumber}`,
      status: 'Warning',
      metadata: { caseNumber: updated.caseNumber, disputeNotes }
    });

    res.json({ success: true, case: updated, message: 'Dispute submitted for arbitration review.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error submitting dispute' });
  }
});

// 8. Resolve dispute (Admin)
caseRouter.post('/:id/resolve-dispute', requireAdmin, (req, res) => {
  try {
    const { resolutionNotes, actor, role, newStatus } = req.body;
    if (!resolutionNotes) {
      return res.status(400).json({ success: false, message: 'Resolution notes are required.' });
    }

    const updated = CaseRepository.resolveDispute(
      req.params.id,
      actor || 'Senior Arbiter',
      role || 'Super Admin',
      resolutionNotes,
      newStatus || 'resolved'
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    AuditRepository.add({
      user: actor || 'Admin',
      role: role || 'Super Admin',
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
