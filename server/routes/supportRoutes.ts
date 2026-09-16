import { Router } from 'express';
import { SupportRepository, CaseRepository, AuditRepository } from '../db/repositories';
import { requireAdmin } from '../auth/authManager';

export const supportRouter = Router();

// 1. Get support tickets
supportRouter.get('/', async (req, res) => {
  try {
    const { userId } = req.query as Record<string, string>;
    const tickets = await SupportRepository.getAllAsync(userId);
    res.json({ success: true, tickets });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching support tickets' });
  }
});

// 2. Get single ticket by ID or Ticket Number
supportRouter.get('/:id', async (req, res) => {
  try {
    const ticket = await SupportRepository.getByIdAsync(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching ticket' });
  }
});


// 3. Create ticket (and link to Universal Case system)
supportRouter.post('/', (req, res) => {
  try {
    const { userId, userName, userEmail, subject, category, priority, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and initial message are required.' });
    }

    const newTicket = SupportRepository.create({
      userId: userId || 'guest',
      userName: userName || 'Job Seeker',
      userEmail: userEmail || 'user@jobportal.com',
      subject,
      category: category || 'General',
      priority: priority || 'medium',
      status: 'open',
      messages: [
        {
          id: `msg-1`,
          senderId: userId || 'guest',
          senderName: userName || 'Job Seeker',
          senderRole: 'Member',
          message,
          timestamp: new Date().toISOString()
        }
      ]
    });

    // Also register in Universal Case tracking system
    CaseRepository.create({
      type: 'support',
      referenceId: newTicket.id,
      title: `Support Ticket: ${subject} (${category || 'General'})`,
      userId: newTicket.userId,
      userName: newTicket.userName,
      userEmail: newTicket.userEmail,
      status: 'pending',
      priority: newTicket.priority,
      metadata: { ticketNumber: newTicket.ticketNumber, category: newTicket.category }
    });

    AuditRepository.add({
      user: userName || 'Member',
      role: 'Member',
      action: 'Support Ticket Opened',
      target: `${newTicket.ticketNumber}: ${subject}`,
      status: 'Success',
      metadata: { ticketNumber: newTicket.ticketNumber, category }
    });

    res.status(201).json({ success: true, ticket: newTicket });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error creating ticket' });
  }
});

// 4. Post message to ticket thread
supportRouter.post('/:id/messages', (req, res) => {
  try {
    const { senderId, senderName, senderRole, message, attachments } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required.' });
    }

    const updated = SupportRepository.addMessage(req.params.id, {
      senderId: senderId || 'user',
      senderName: senderName || 'Member',
      senderRole: senderRole || 'Job Seeker',
      message,
      attachments
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    res.json({ success: true, ticket: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error adding message' });
  }
});

// 5. Update ticket status (Admin or User resolve)
supportRouter.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    const updated = SupportRepository.updateStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    res.json({ success: true, ticket: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating status' });
  }
});
