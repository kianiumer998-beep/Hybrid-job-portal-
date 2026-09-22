import { Router } from 'express';
import { SupportRepository, CaseRepository, AuditRepository } from '../db/repositories';
import { requireAuth, authMiddleware } from '../auth/authManager';

export const supportRouter = Router();

// 1. Get support tickets (strictly filtered for non-admin users)
supportRouter.get('/', authMiddleware, async (req: any, res) => {
  try {
    const isAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin';
    const currentUserId = req.user?.userId || req.user?.id;

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required to view tickets.' });
    }

    const queryUserId = req.query.userId as string | undefined;
    const targetUserId = isAdmin && queryUserId ? queryUserId : (isAdmin ? undefined : currentUserId);

    const tickets = await SupportRepository.getAllAsync(targetUserId);
    res.json({ success: true, tickets });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching support tickets' });
  }
});

// 2. Get single ticket by ID or Ticket Number
supportRouter.get('/:id', authMiddleware, async (req: any, res) => {
  try {
    const ticket = await SupportRepository.getByIdAsync(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const isAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin';
    const currentUserId = req.user?.userId || req.user?.id;

    if (!isAdmin && ticket.userId && ticket.userId !== 'guest' && ticket.userId !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only view your own support tickets.' });
    }

    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching ticket' });
  }
});

// 3. Create ticket (and link to Universal Case system)
supportRouter.post('/', authMiddleware, async (req: any, res) => {
  try {
    const { subject, category, priority, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and initial message are required.' });
    }

    // Authoritative user context if authenticated
    const targetUserId = req.user?.userId || req.user?.id || 'guest';
    const targetUserName = req.user?.name || req.body.userName || 'Job Seeker';
    const targetUserEmail = req.user?.email || req.body.userEmail || '';

    const newTicket = await SupportRepository.createAsync({
      userId: targetUserId,
      userName: targetUserName,
      userEmail: targetUserEmail,
      subject,
      category: category || 'General',
      priority: priority || 'medium',
      status: 'open',
      messages: [
        {
          id: `msg-${Date.now()}`,
          senderId: targetUserId,
          senderName: targetUserName,
          senderRole: req.user?.role || 'Member',
          message,
          timestamp: new Date().toISOString()
        }
      ]
    });

    // Also register in Universal Case tracking system
    await CaseRepository.createAsync({
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
      user: targetUserName,
      role: req.user?.role || 'Member',
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
supportRouter.post('/:id/messages', requireAuth, async (req: any, res) => {
  try {
    const { message, attachments } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required.' });
    }

    const ticket = await SupportRepository.getByIdAsync(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const isAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin';
    const currentUserId = req.user?.userId || req.user?.id;

    if (!isAdmin && ticket.userId && ticket.userId !== 'guest' && ticket.userId !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Access denied: You cannot reply to another user\'s support ticket.' });
    }

    const updated = await SupportRepository.addMessageAsync(ticket.id, {
      senderId: currentUserId,
      senderName: req.user?.name || 'Member',
      senderRole: req.user?.role || 'Member',
      message,
      attachments
    });

    res.json({ success: true, ticket: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error adding message' });
  }
});

// 5. Update ticket status (Admin or Ticket Owner resolve/close)
supportRouter.patch('/:id/status', requireAuth, async (req: any, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    const ticket = await SupportRepository.getByIdAsync(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const isAdmin = req.user?.role === 'Admin' || req.user?.role === 'Super Admin';
    const currentUserId = req.user?.userId || req.user?.id;

    if (!isAdmin) {
      if (ticket.userId !== currentUserId) {
        return res.status(403).json({ success: false, message: 'Access denied: You can only update your own ticket.' });
      }
      if (!['resolved', 'closed'].includes(status)) {
        return res.status(403).json({ success: false, message: 'Users can only mark their tickets as resolved or closed.' });
      }
    }

    const updated = await SupportRepository.updateStatusAsync(ticket.id, status);
    res.json({ success: true, ticket: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating status' });
  }
});
