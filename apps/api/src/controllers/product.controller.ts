import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function createProduct(req: AuthRequest, res: Response) {
  try {
    const { name, description, category } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    // Check if product already exists
    const existingProduct = await prisma.product.findUnique({ where: { name } });
    if (existingProduct) {
      return res.status(400).json({ error: 'Product with this name already exists' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        category,
        created_by: req.user!.userId,
      },
    });

    res.status(201).json({ product });
  } catch (error) {
    logger.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
}

export async function getProducts(req: AuthRequest, res: Response) {
  try {
    const { search, category, page = '1', limit = '20', sortBy, sortOrder } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = { contains: String(category), mode: 'insensitive' };
    }

    // Server-side sorting
    const sortDir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    const sortFieldMap: Record<string, any> = {
      name: { name: sortDir },
      category: { category: sortDir },
      created_at: { created_at: sortDir },
    };
    const orderBy = sortFieldMap[String(sortBy || '')] || { created_at: 'desc' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          created_at: true,
          updated_at: true,
          creator: { select: { id: true, name: true } },
          updater: { select: { id: true, name: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to get products' });
  }
}

export async function getProductCategories(req: AuthRequest, res: Response) {
  try {
    const categories = await prisma.product.findMany({
      where: {
        category: {
          not: null,
        },
      },
      select: {
        category: true,
      },
      distinct: ['category'],
      orderBy: {
        category: 'asc',
      },
    });

    const categoryList = categories
      .map((p) => p.category)
      .filter((c): c is string => c !== null);

    res.json({ categories: categoryList });
  } catch (error) {
    logger.error('Get product categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
}

export async function getProductById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        trials: {
          select: {
            id: true,
            crop: true,
            start_date: true,
            status: true,
            farmer: {
              select: {
                id: true,
                name: true,
                location: { select: { village: true, district: true, state: true } },
              },
            },
          },
          orderBy: { start_date: 'desc' },
        },
        creator: { select: { id: true, name: true } },
        updater: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product });
  } catch (error) {
    logger.error('Get product by ID error:', error);
    res.status(500).json({ error: 'Failed to get product' });
  }
}

export async function updateProduct(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, category } = req.body;

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if new name conflicts with existing product
    if (name && name !== existingProduct.name) {
      const nameExists = await prisma.product.findUnique({ where: { name } });
      if (nameExists) {
        return res.status(400).json({ error: 'Product with this name already exists' });
      }
    }

    const updateData: any = {
      updated_by: req.user!.userId,
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        created_at: true,
        updated_at: true,
        creator: { select: { id: true, name: true } },
        updater: { select: { id: true, name: true } },
      },
    });

    res.json({ product });
  } catch (error) {
    logger.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
}

export async function deleteProduct(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        trials: { select: { id: true } },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if product has trials
    if (product.trials.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete product with associated trials',
        trialsCount: product.trials.length,
      });
    }

    await prisma.product.delete({ where: { id } });

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    logger.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
}
