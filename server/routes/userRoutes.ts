import { Router } from 'express';
import { Database } from '../db/database';
import { requireAdmin, requireAuth } from '../auth/authManager';

export const userRouter = Router();

// 1. Get All Users (Admin Only)
userRouter.get('/', requireAdmin, (req, res) => {
  try {
    const users = Database.getUsers().map(u => {
      const { passwordHash, salt, password, ...safe } = u;
      return safe;
    });
    res.json({ success: true, users });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching users' });
  }
});

// 2. Update User Profile or Admin Status
userRouter.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Do not allow updating passwordHash directly via this endpoint
    delete updates.passwordHash;
    delete updates.salt;

    const updated = Database.updateUser(id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const { passwordHash, salt, password, ...safeUser } = updated;
    res.json({ success: true, user: safeUser, message: 'User profile updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Error updating user' });
  }
});
