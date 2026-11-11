import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth/authManager';
import { ChatMessageRepository } from '../db/repositories/ChatMessageRepository';
import { UserRepository } from '../db/repositories/UserRepository';
import { ChatMessage } from '../../src/types/job';

const router = Router();

// GET /api/chat - Get authenticated user's own messages
router.get('/', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const messages = await ChatMessageRepository.getByUserId(userId);
    // UI expects chronological order; repository already returns sorted by timestamp.
    res.json({ success: true, messages });
  } catch (err: any) {
    console.error('[Chat API] Error fetching user messages:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch chat messages.' });
  }
});

// POST /api/chat - Send message from authenticated user
router.post('/', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { id, text, jobTitleRef } = req.body;

    if (typeof id !== 'string' || !id.trim() || id.length > 100) {
      return res.status(400).json({ success: false, message: 'Valid Message ID is required.' });
    }

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required.' });
    }

    if (text.length > 2000) {
      return res.status(400).json({ success: false, message: 'Message is too long (max 2000 characters).' });
    }

    if (jobTitleRef !== undefined && (typeof jobTitleRef !== 'string' || jobTitleRef.length > 200)) {
      return res.status(400).json({ success: false, message: 'Invalid jobTitleRef format.' });
    }

    const newMessage: ChatMessage = {
      id: id.trim(),
      userId,
      userName: req.user.name || 'Member',
      senderRole: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString(), // Server-authoritative timestamp
      jobTitleRef: jobTitleRef?.trim() || undefined
    };

    const saved = await ChatMessageRepository.save(newMessage);
    res.json({ success: true, message: saved });
  } catch (err: any) {
    console.error('[Chat API] Error saving user message:', err);
    res.status(500).json({ success: false, message: 'Failed to send chat message.' });
  }
});

// GET /api/chat/admin/all - Admin: Get all conversations
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    let limit = parseInt(req.query.limit as string) || 2000;
    if (isNaN(limit) || limit <= 0) limit = 2000;
    limit = Math.min(limit, 10000); // Guard against excessively large requests

    const messages = await ChatMessageRepository.getAll(limit);
    res.json({ success: true, messages });
  } catch (err: any) {
    console.error('[Chat API] Error fetching all messages for admin:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch all chat messages.' });
  }
});

// POST /api/chat/admin/reply - Admin: Send reply to a specific user
router.post('/admin/reply', requireAdmin, async (req: any, res) => {
  try {
    const { userId: targetUserId, text, jobTitleRef, id } = req.body;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return res.status(400).json({ success: false, message: 'Target user ID is required for admin reply.' });
    }

    // Verify target user existence
    const targetUser = await UserRepository.getByIdAsync(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: `Target user with ID '${targetUserId}' does not exist.` });
    }

    if (typeof id !== 'string' || !id.trim() || id.length > 100) {
      return res.status(400).json({ success: false, message: 'Valid Message ID is required.' });
    }

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Reply text is required.' });
    }

    if (text.length > 2000) {
      return res.status(400).json({ success: false, message: 'Message is too long (max 2000 characters).' });
    }

    const adminMessage: ChatMessage = {
      id: id.trim(),
      userId: targetUserId,
      userName: req.user.name || 'Portal Admin', // Derive from authenticated admin session
      senderRole: 'admin',
      text: text.trim(),
      timestamp: new Date().toISOString(), // Server-authoritative timestamp
      jobTitleRef: jobTitleRef?.trim() || undefined
    };

    const saved = await ChatMessageRepository.save(adminMessage);
    res.json({ success: true, message: saved });
  } catch (err: any) {
    console.error('[Chat API] Error saving admin reply:', err);
    res.status(500).json({ success: false, message: 'Failed to send admin reply.' });
  }
});

// POST /api/chat/import-legacy - Admin: Bulk import legacy messages
router.post('/import-legacy', requireAdmin, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ success: false, message: 'Messages array is required for import.' });
    }

    if (messages.length > 1000) {
      return res.status(400).json({ success: false, message: 'Import batch too large (max 1000 messages).' });
    }

    const results = {
      imported: 0,
      skipped: 0,
      failed: 0
    };

    for (const msg of messages) {
      try {
        // Validation: skip synthetic demo message or malformed records
        if (!msg || typeof msg !== 'object') {
          results.skipped++;
          continue;
        }
        
        if (msg.id === 'msg-1') {
          results.skipped++;
          continue;
        }

        // Deep validation of legacy record
        const isValid = 
          typeof msg.id === 'string' && msg.id.length > 0 &&
          typeof msg.userId === 'string' && msg.userId.length > 0 &&
          typeof msg.text === 'string' && msg.text.trim().length > 0 &&
          (msg.senderRole === 'user' || msg.senderRole === 'admin');

        if (!isValid) {
          results.skipped++;
          continue;
        }

        const normalizedMsg: ChatMessage = {
          id: msg.id,
          userId: msg.userId,
          userName: typeof msg.userName === 'string' ? msg.userName : 'Unknown',
          senderRole: msg.senderRole,
          text: msg.text.trim(),
          timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : new Date().toISOString(),
          jobTitleRef: typeof msg.jobTitleRef === 'string' ? msg.jobTitleRef : undefined
        };

        await ChatMessageRepository.save(normalizedMsg);
        results.imported++;
      } catch (err: any) {
        results.failed++;
      }
    }

    res.json({ success: true, ...results });
  } catch (err: any) {
    console.error('[Chat API] Error importing legacy messages:', err);
    res.status(500).json({ success: false, message: 'Failed to import messages.' });
  }
});

export { router as chatRouter };
