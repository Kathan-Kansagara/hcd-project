import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';
import bcrypt from 'bcrypt';

export async function getUsers(req: AuthRequest, res: Response) {
  try {
    const { search, role, page = '1', limit = '20', sortBy, sortOrder } = req.query;

    // Only admins can view users
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
        { username: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = String(role);
    }

    const sortDir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    const sortFieldMap: Record<string, any> = {
      name: { name: sortDir },
      email: { email: sortDir },
      username: { username: sortDir },
      role: { role: sortDir },
      created_at: { created_at: sortDir },
    };
    const orderBy = sortFieldMap[String(sortBy || '')] || { created_at: 'desc' };

    const [rawUsers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy,
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
      }),
      prisma.user.count({ where }),
    ]);

    // Normalize permissions to always be an array
    const users = rawUsers.map(user => ({
      ...user,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    }));

    res.json({
      users,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function getUserById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Users can view their own profile, admins can view any profile
    if (req.user!.role !== 'ADMIN' && req.user!.userId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const rawUser = await prisma.user.findUnique({
      where: { id },
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

    if (!rawUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Normalize permissions to always be an array
    const user = {
      ...rawUser,
      permissions: Array.isArray(rawUser.permissions) ? rawUser.permissions : [],
    };

    res.json({ user });
  } catch (error) {
    logger.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

export async function createUser(req: AuthRequest, res: Response) {
  try {
    const { email, username, password, name, role, permissions } = req.body;

    // Only admins can create users
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate required fields
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(username ? [{ username }] : []),
        ],
      },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    const createdUser = await prisma.user.create({
      data: {
        email,
        username,
        password_hash,
        name,
        role: role || 'SUBADMIN',
        permissions: Array.isArray(permissions) ? permissions : [],
      },
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

    const user = {
      ...createdUser,
      permissions: Array.isArray(createdUser.permissions) ? createdUser.permissions : [],
    };

    res.status(201).json({ user });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

export async function updateUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { email, username, name, role, password, permissions } = req.body;

    // Users can update their own profile, admins can update any profile
    if (req.user!.role !== 'ADMIN' && req.user!.userId !== id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Non-admins cannot change roles
    if (req.user!.role !== 'ADMIN' && role) {
      return res.status(403).json({ error: 'Cannot change role' });
    }

    const updateData: any = {};

    if (email) updateData.email = email;
    if (username) updateData.username = username;
    if (name) updateData.name = name;
    if (role && req.user!.role === 'ADMIN') updateData.role = role;
    if (permissions && req.user!.role === 'ADMIN') updateData.permissions = permissions;
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
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

    const user = {
      ...updatedUser,
      permissions: Array.isArray(updatedUser.permissions) ? updatedUser.permissions : [],
    };

    res.json({ user });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
}

export async function deleteUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Only admins can delete users
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Prevent deleting yourself
    if (req.user!.userId === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
}
