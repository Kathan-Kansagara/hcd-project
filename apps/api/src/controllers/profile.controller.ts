import { Response } from 'express';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../types/index.js';
import { prisma } from '@zenon/database';
import logger from '../config/logger.js';

/**
 * Get current user profile
 */
export async function getProfile(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

/**
 * Update current user profile
 */
export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const { name, email } = req.body;

    if (!name && !email) {
      return res.status(400).json({ error: 'Name or email is required' });
    }

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: req.user!.userId },
        },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Email is already in use' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        created_at: true,
        updated_at: true,
      },
    });

    res.json({ user: updatedUser });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

/**
 * Update current user password
 */
export async function updatePassword(req: AuthRequest, res: Response) {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        error: 'Current password and new password are required',
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        error: 'New password must be at least 6 characters long',
      });
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { password_hash: hashedPassword },
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
}
