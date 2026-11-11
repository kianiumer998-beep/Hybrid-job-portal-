import { Router } from 'express';
import { requireAuth, requireAdmin } from '../auth/authManager';
import { ChatMessageRepository } from '../db/repositories/ChatMessageRepository';
import { ChatMessage } from '../../src/types/job';

const router = Router();

// GET /api/chat - Get authenticated user's own messages
router.get('/', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const messages = await ChatMessageRepository.getByUserId(userId);
    res.json({ success: true, messages });
  } catch (err: any) {
    console.error('[Chat API] Error fetching user messages:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch chat messages.' });
  }
});

// POST /api/chat - Send message from authenticated user
router.post('/', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { id, text, timestamp, jobTitleRef } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required.' });
    }

    if (text.length > 2000) {
      return res.status(400).json({ success: false, message: 'Message is too long (max 2000 characters).' });
    }

    const newMessage: ChatMessage = {
      id: id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      userName: req.user.name || 'Member',
      senderRole: 'user',
      text: text.trim(),
      timestamp: timestamp || new Date().toISOString(),
      jobTitleRef
    };

    const saved = await ChatMessageRepository.save(newMessage);
    res.json({ success: true, message: saved });
  } catch (err: any) {
    console.error('[Chat API] Error saving user message:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to send chat message.' });
  }
});

// GET /api/chat/admin/all - Admin: Get all conversations
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 2000;
    const messages = await ChatMessageRepository.getAll(limit);
    res.json({ success: true, messages });
  } catch (err: any) {
    console.error('[Chat API] Error fetching all messages for admin:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch all chat messages.' });
  }
});

// POST /api/chat/admin/reply - Admin: Send reply to a specific user
router.post('/admin/reply', requireAdmin, async (req: any, res) => {
  try {
    const { userId, userName, text, timestamp, jobTitleRef, id } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Target user ID is required for admin reply.' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Reply text is required.' });
    }

    if (text.length > 2000) {
      return res.status(400).json({ success: false, message: 'Message is too long (max 2000 characters).' });
    }

    const adminMessage: ChatMessage = {
      id: id || `msg-adm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      userName: userName || 'Portal Admin',
      senderRole: 'admin',
      text: text.trim(),
      timestamp: timestamp || new Date().toISOString(),
      jobTitleRef
    };

    const saved = await ChatMessageRepository.save(adminMessage);
    res.json({ success: true, message: saved });
  } catch (err: any) {
    console.error('[Chat API] Error saving admin reply:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to send admin reply.' });
  }
});

// POST /api/chat/import-legacy - Admin: Bulk import legacy messages
router.post('/import-legacy', requireAdmin, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      return res.status(400).json({ success: false, message: 'Messages array is required for import.' });
    }

    const results = {
      imported: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const msg of messages) {
      try {
        // Validation: skip synthetic demo message
        if (msg.id === 'msg-1') continue;
        if (!msg.userId || !msg.text) continue;

        await ChatMessageRepository.save(msg);
        results.imported++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Message ${msg.id}: ${err.message}`);
      }
    }

    res.json({ success: true, ...results });
  } catch (err: any) {
    console.error('[Chat API] Error importing legacy messages:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to import messages.' });
  }
});

export { router as chatRouter };
