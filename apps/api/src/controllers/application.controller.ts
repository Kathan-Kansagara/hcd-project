import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function createApplication(req: AuthRequest, res: Response) {
  try {
    const {
      trial_id,
      app_number,
      app_type,
      app_date,
      status,
      before_comments,
      after_comments,
      batch_id,
      quantity_used,
    } = req.body;

    // Validate required fields
    if (!trial_id || !app_number || !app_type || !app_date) {
      return res.status(400).json({
        error: 'Trial, application number, type, and date are required',
      });
    }

    // Verify trial exists
    const trial = await prisma.trial.findUnique({ where: { id: trial_id } });
    if (!trial) {
      return res.status(404).json({ error: 'Trial not found' });
    }

    // Check if application number already exists for this trial
    const existingApp = await prisma.application.findFirst({
      where: { trial_id, app_number },
    });
    if (existingApp) {
      return res.status(400).json({
        error: `Application number ${app_number} already exists for this trial`,
      });
    }

    // If batch_id is provided, validate and deduct quantity
    if (batch_id) {
      const batch = await prisma.batch.findUnique({ where: { id: batch_id } });

      if (!batch) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      if (!batch.is_active) {
        return res.status(400).json({ error: 'Batch is not active' });
      }

      // Check if batch is expired
      if (new Date(batch.expiry_date) < new Date()) {
        return res.status(400).json({ error: 'Batch has expired' });
      }

      // If quantity_used is provided, check if sufficient quantity is available
      if (quantity_used) {
        const qtyUsed = parseFloat(quantity_used);
        if (qtyUsed > batch.quantity_remaining) {
          return res.status(400).json({
            error: `Insufficient quantity. Available: ${batch.quantity_remaining} ${batch.unit}`,
          });
        }
      }
    }

    // Use transaction to ensure atomic operations
    const result = await prisma.$transaction(async (tx) => {
      // Create application
      const application = await tx.application.create({
        data: {
          trial_id,
          app_number,
          app_type,
          app_date: new Date(app_date),
          status: status || 'pending',
          before_comments,
          after_comments,
          batch_id: batch_id || null,
          quantity_used: quantity_used ? parseFloat(quantity_used) : null,
          created_by: req.user!.userId,
        },
        include: {
          trial: {
            select: {
              id: true,
              crop: true,
              farmer: {
                select: {
                  id: true,
                  name: true,
                  location: {
                    select: {
                      village: true, district: true, state: true, pincode: true,
                    },
                  },
                },
              },
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          batch: {
            select: {
              id: true,
              batch_number: true,
              quantity_remaining: true,
              unit: true,
            },
          },
        },
      });

      // Deduct quantity from batch if applicable
      if (batch_id && quantity_used) {
        await tx.batch.update({
          where: { id: batch_id },
          data: {
            quantity_remaining: {
              decrement: parseFloat(quantity_used),
            },
            updated_by: req.user!.userId,
          },
        });
      }

      return application;
    });

    res.status(201).json({ application: result });
  } catch (error) {
    logger.error('Create application error:', error);
    res.status(500).json({ error: 'Failed to create application' });
  }
}

export async function getApplications(req: AuthRequest, res: Response) {
  try {
    const {
      trial_id,
      app_type,
      status,
      page = '1',
      limit = '20',
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    if (trial_id) where.trial_id = String(trial_id);
    if (app_type) where.app_type = String(app_type);
    if (status) where.status = String(status);

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip,
        take,
        orderBy: [{ trial_id: 'asc' }, { app_number: 'asc' }],
        include: {
          trial: {
            select: {
              id: true,
              crop: true,
              farmer: {
                select: {
                  id: true,
                  name: true,
                  location: {
                    select: {
                      village: true, district: true, state: true, pincode: true,
                    },
                  },
                },
              },
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          batch: {
            select: {
              id: true,
              batch_number: true,
              unit: true,
            },
          },
          photos: {
            select: {
              id: true,
              stage: true,
              file_path: true,
              file_url: true,
              created_at: true,
            },
          },
        },
      }),
      prisma.application.count({ where }),
    ]);

    res.json({
      applications,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get applications error:', error);
    res.status(500).json({ error: 'Failed to get applications' });
  }
}

export async function getApplicationById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        trial: {
          select: {
            id: true,
            crop: true,
            season: true,
            location: {
              select: {
                village: true, district: true, state: true, pincode: true,
              },
            },
            farmer: {
              select: {
                id: true,
                name: true,
                contact: true,
                location: {
                  select: {
                    village: true, district: true, state: true, pincode: true,
                  },
                },
              },
            },
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                category: true,
              },
            },
          },
        },
        batch: {
          select: {
            id: true,
            batch_number: true,
            expiry_date: true,
            unit: true,
          },
        },
        photos: {
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ application });
  } catch (error) {
    logger.error('Get application by ID error:', error);
    res.status(500).json({ error: 'Failed to get application' });
  }
}

export async function updateApplication(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const {
      app_date,
      status,
      before_comments,
      after_comments,
      batch_id,
      quantity_used,
    } = req.body;

    // Check if application exists
    const existingApp = await prisma.application.findUnique({ where: { id } });
    if (!existingApp) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Determine if we need to handle batch inventory changes
    const oldBatchId = existingApp.batch_id;
    const oldQuantity = existingApp.quantity_used ? parseFloat(String(existingApp.quantity_used)) : 0;
    const newBatchId = batch_id !== undefined ? (batch_id || null) : oldBatchId;
    const newQuantity = quantity_used !== undefined ? (quantity_used ? parseFloat(String(quantity_used)) : 0) : oldQuantity;

    // If batch_id is being updated, verify batch exists and has sufficient quantity
    if (newBatchId) {
      const batch = await prisma.batch.findUnique({ where: { id: newBatchId } });
      if (!batch) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      if (!batch.is_active) {
        return res.status(400).json({ error: 'Batch is not active' });
      }

      if (new Date(batch.expiry_date) < new Date()) {
        return res.status(400).json({ error: 'Batch has expired' });
      }

      // Calculate required quantity
      // If changing batch: need full new quantity
      // If same batch: need difference between new and old quantity
      let requiredQuantity = 0;
      if (oldBatchId === newBatchId) {
        // Same batch, calculate difference
        requiredQuantity = newQuantity - oldQuantity;
      } else {
        // Different batch, need full new quantity
        requiredQuantity = newQuantity;
      }

      // Check if sufficient quantity available
      if (requiredQuantity > 0 && requiredQuantity > batch.quantity_remaining) {
        return res.status(400).json({
          error: `Insufficient quantity. Available: ${batch.quantity_remaining} ${batch.unit}, Required: ${requiredQuantity} ${batch.unit}`,
        });
      }
    }

    const updateData: any = {
      updated_by: req.user!.userId,
    };

    if (app_date !== undefined) updateData.app_date = new Date(app_date);
    if (status !== undefined) updateData.status = status;
    if (before_comments !== undefined) updateData.before_comments = before_comments;
    if (after_comments !== undefined) updateData.after_comments = after_comments;
    if (batch_id !== undefined) updateData.batch_id = batch_id;
    if (quantity_used !== undefined) updateData.quantity_used = quantity_used ? parseFloat(quantity_used) : null;

    // Use transaction to ensure atomic operations
    const result = await prisma.$transaction(async (tx) => {
      // Handle batch inventory changes
      if (oldBatchId === newBatchId) {
        // Same batch: only adjust the difference
        const quantityDiff = newQuantity - oldQuantity;
        if (quantityDiff !== 0 && newBatchId) {
          await tx.batch.update({
            where: { id: newBatchId },
            data: {
              quantity_remaining: {
                [quantityDiff > 0 ? 'decrement' : 'increment']: Math.abs(quantityDiff),
              },
              updated_by: req.user!.userId,
            },
          });
        }
      } else {
        // Different batch: restore old and deduct new
        // Step 1: Restore quantity to old batch if it exists and had quantity
        if (oldBatchId && oldQuantity > 0) {
          await tx.batch.update({
            where: { id: oldBatchId },
            data: {
              quantity_remaining: {
                increment: oldQuantity,
              },
              updated_by: req.user!.userId,
            },
          });
        }

        // Step 2: Deduct quantity from new batch if it exists and has quantity
        if (newBatchId && newQuantity > 0) {
          await tx.batch.update({
            where: { id: newBatchId },
            data: {
              quantity_remaining: {
                decrement: newQuantity,
              },
              updated_by: req.user!.userId,
            },
          });
        }
      }

      // Step 3: Update the application
      const application = await tx.application.update({
        where: { id },
        data: updateData,
        include: {
          trial: {
            select: {
              id: true,
              crop: true,
              farmer: {
                select: {
                  id: true,
                  name: true,
                  location: {
                    select: {
                      village: true, district: true, state: true, pincode: true,
                    },
                  },
                },
              },
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          batch: {
            select: {
              id: true,
              batch_number: true,
              quantity_remaining: true,
              unit: true,
            },
          },
        },
      });

      return application;
    });

    res.json({ application: result });
  } catch (error) {
    logger.error('Update application error:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
}

export async function deleteApplication(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if application exists
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        photos: { select: { id: true } },
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Delete application (photos will be cascade deleted)
    await prisma.application.delete({ where: { id } });

    res.json({
      message: 'Application deleted successfully',
      deletedPhotos: application.photos.length,
    });
  } catch (error) {
    logger.error('Delete application error:', error);
    res.status(500).json({ error: 'Failed to delete application' });
  }
}
