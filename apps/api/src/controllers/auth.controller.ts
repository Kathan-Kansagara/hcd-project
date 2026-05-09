import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '@zenon/database';
import { generateToken } from '../utils/jwt.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function register(req: Request, res: Response) {
  try {
    const { email, username, password, name, role } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if user exists (by email or username if provided)
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(username ? [{ username }] : []),
        ],
      },
    });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password_hash,
        name,
        role: role || 'SUBADMIN',
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        permissions: true,
        created_at: true,
      },
    });

    // Generate token with permissions
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: (user.permissions as string[]) || [],
    });

    res.status(201).json({
      user,
      token,
    });
  } catch (error) {
    logger.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { identifier, email, password } = req.body;
    const loginId = identifier || email;

    // Validate input
    if (!loginId || !password) {
      return res.status(400).json({ error: 'Email/Username and password are required' });
    }

    // Find user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: loginId },
          { username: loginId },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token with permissions
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: (user.permissions as string[]) || [],
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions: (user.permissions as string[]) || [],
        created_at: user.created_at,
      },
      token,
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        username: true,
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
    logger.error('GetMe error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
}
