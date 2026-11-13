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
      timestamp: new Date().toISOString(),
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
    let limit = 2000;
    const rawLimit = req.query.limit;
    if (rawLimit !== undefined) {
      const limitStr = String(rawLimit).trim();
      if (!/^\d+$/.test(limitStr)) {
        return res.status(400).json({ success: false, message: 'Invalid limit parameter. Must be a positive safe integer.' });
      }
      const parsed = Number(limitStr);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid limit parameter. Must be a positive safe integer.' });
      }
      limit = Math.min(parsed, 10000);
    }

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
      userName: req.user.name || 'Portal Admin',
      senderRole: 'admin',
      text: text.trim(),
      timestamp: new Date().toISOString(),
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
      alreadyExists: 0,
      skippedSynthetic: 0,
      skipped: 0,
      failed: 0
    };

    for (const msg of messages) {
      try {
        if (!msg || typeof msg !== 'object') {
          results.failed++;
          continue;
        }

        if (msg.id === 'msg-1') {
          results.skippedSynthetic++;
          results.skipped++;
          continue;
        }

        // Validate basic fields
        if (typeof msg.id !== 'string' || !msg.id.trim() || msg.id.length > 100) {
          results.failed++;
          continue;
        }
        if (typeof msg.userId !== 'string' || !msg.userId.trim()) {
          results.failed++;
          continue;
        }
        if (typeof msg.text !== 'string' || !msg.text.trim() || msg.text.length > 2000) {
          results.failed++;
          continue;
        }
        if (msg.senderRole !== 'user' && msg.senderRole !== 'admin') {
          results.failed++;
          continue;
        }
        // Validate timestamp as real valid date
        if (typeof msg.timestamp !== 'string' || isNaN(Date.parse(msg.timestamp))) {
          results.failed++;
          continue;
        }

        // Verify target user existence
        const userExists = await UserRepository.getByIdAsync(msg.userId);
        if (!userExists) {
          results.failed++;
          continue;
        }

        const normalizedMsg: ChatMessage = {
          id: msg.id.trim(),
          userId: msg.userId.trim(),
          userName: typeof msg.userName === 'string' && msg.userName.trim() ? msg.userName.trim() : (userExists.name || 'Member'),
          senderRole: msg.senderRole,
          text: msg.text.trim(),
          timestamp: msg.timestamp.trim(),
          jobTitleRef: typeof msg.jobTitleRef === 'string' && msg.jobTitleRef.trim() ? msg.jobTitleRef.trim() : undefined
        };

        const saveResult = await ChatMessageRepository.saveWithDetails(normalizedMsg);

        if (saveResult.conflict) {
          results.failed++;
        } else if (saveResult.isNew) {
          results.imported++;
        } else {
          results.alreadyExists++;
        }
      } catch (err: any) {
        results.failed++;
      }
    }

    const success = results.failed === 0;
    res.json({ success, ...results });
  } catch (err: any) {
    console.error('[Chat API] Error importing legacy messages:', err);
    res.status(500).json({ success: false, message: 'Failed to import messages.' });
  }
});

export { router as chatRouter };
