import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function createBatchWithConsumption(req: AuthRequest, res: Response) {
  try {
    const {
      product_id,
      batch_number,
      manufacturing_date,
      expiry_date,
      quantity_produced,
      unit,
      storage_location,
      notes,
    } = req.body;

    // Validate required fields
    if (!product_id || !batch_number || !manufacturing_date || !expiry_date || !quantity_produced || !unit) {
      return res.status(400).json({ error: 'Missing required fields for batch' });
    }

    // Check if batch number already exists
    const existingBatch = await prisma.batch.findUnique({ where: { batch_number } });
    if (existingBatch) {
      return res.status(400).json({ error: 'Batch number already exists' });
    }

    // Check if product exists and fetch BOM
    const product = await prisma.product.findUnique({
      where: { id: product_id },
      include: {
        bom_items: {
          include: {
            raw_material: true,
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Calculate required raw materials from BOM
    const requiredMaterials: { raw_material_id: string; quantity_required: number; unit: string; name: string }[] = [];

    for (const bomItem of product.bom_items) {
      const quantityRequired = bomItem.quantity_per_unit * parseFloat(quantity_produced);
      requiredMaterials.push({
        raw_material_id: bomItem.raw_material_id,
        quantity_required: quantityRequired,
        unit: bomItem.unit,
        name: bomItem.raw_material.name,
      });
    }

    // Find available RM batches for each required material (FIFO - oldest first)
    const raw_material_consumptions: { raw_material_batch_id: string; quantity_consumed: number; unit: string }[] = [];

    for (const required of requiredMaterials) {
      let remainingQty = required.quantity_required;

      // Get available batches for this RM, ordered by receipt date (FIFO)
      const availableBatches = await prisma.rawMaterialBatch.findMany({
        where: {
          raw_material_id: required.raw_material_id,
          quantity_remaining: { gt: 0 },
        },
        orderBy: {
          receipt_date: 'asc', // FIFO - oldest first
        },
      });

      if (availableBatches.length === 0) {
        return res.status(400).json({
          error: `No available batches for raw material: ${required.name}. Required: ${required.quantity_required} ${required.unit}`,
        });
      }

      // Calculate total available quantity
      const totalAvailable = availableBatches.reduce((sum, batch) => sum + batch.quantity_remaining, 0);

      if (totalAvailable < remainingQty) {
        return res.status(400).json({
          error: `Insufficient stock for ${required.name}. Required: ${required.quantity_required} ${required.unit}, Available: ${totalAvailable} ${required.unit}`,
        });
      }

      // Allocate from batches using FIFO
      for (const batch of availableBatches) {
        if (remainingQty <= 0) break;

        const consumeQty = Math.min(batch.quantity_remaining, remainingQty);
        raw_material_consumptions.push({
          raw_material_batch_id: batch.id,
          quantity_consumed: consumeQty,
          unit: required.unit,
        });

        remainingQty -= consumeQty;
      }
    }

    // Validate all consumptions
    for (const consumption of raw_material_consumptions) {
      const rmBatch = await prisma.rawMaterialBatch.findUnique({
        where: { id: consumption.raw_material_batch_id },
      });

      if (!rmBatch || rmBatch.quantity_remaining < consumption.quantity_consumed) {
        return res.status(400).json({
          error: `Insufficient stock in batch ${rmBatch?.batch_number}`,
        });
      }
    }

    // Create batch and consumption records in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create finished batch
      const batch = await tx.batch.create({
        data: {
          product_id,
          batch_number,
          manufacturing_date: new Date(manufacturing_date),
          expiry_date: new Date(expiry_date),
          quantity_produced: parseFloat(quantity_produced),
          quantity_remaining: parseFloat(quantity_produced),
          unit,
          storage_location,
          notes,
          created_by: req.user!.userId,
        },
      });

      // Create consumption records and update RM batch quantities
      const consumptions = [];
      if (raw_material_consumptions && raw_material_consumptions.length > 0) {
        for (const consumption of raw_material_consumptions) {
          // Create consumption record
          const consumptionRecord = await tx.rawMaterialConsumption.create({
            data: {
              finished_batch_id: batch.id,
              raw_material_batch_id: consumption.raw_material_batch_id,
              quantity_consumed: consumption.quantity_consumed,
              unit: consumption.unit as any,
              created_by: req.user!.userId,
            },
          });

          // Update RM batch quantity
          await tx.rawMaterialBatch.update({
            where: { id: consumption.raw_material_batch_id },
            data: {
              quantity_remaining: {
                decrement: consumption.quantity_consumed,
              },
              updated_by: req.user!.userId,
            },
          });

          consumptions.push(consumptionRecord);
        }
      }

      return { batch, consumptions };
    });

    // Fetch complete data with relations
    const completeData = await prisma.batch.findUnique({
      where: { id: result.batch.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        rm_consumptions: {
          include: {
            raw_material_batch: {
              include: {
                raw_material: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      batch: completeData,
      consumptions_recorded: result.consumptions.length,
    });
  } catch (error) {
    logger.error('Create batch with consumption error:', error);
    res.status(500).json({ error: 'Failed to create batch with consumption' });
  }
}

export async function getBatchTraceability(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        product: true,
        rm_consumptions: {
          include: {
            raw_material_batch: {
              include: {
                raw_material: true,
              },
            },
          },
        },
        applications: {
          include: {
            trial: {
              include: {
                farmer: {
                  select: {
                    id: true,
                    name: true,
                    location: {
                      select: {
                        village: true,
                        district: true,
                        state: true,
                        pincode: true,
                      },
                    },
                  },
                },
                location: {
                  select: {
                    village: true,
                    district: true,
                    state: true,
                    pincode: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Build traceability tree
    const traceability = {
      finished_batch: {
        id: batch.id,
        batch_number: batch.batch_number,
        product: batch.product,
        manufacturing_date: batch.manufacturing_date,
        expiry_date: batch.expiry_date,
        quantity_produced: batch.quantity_produced,
      },
      raw_materials_used: batch.rm_consumptions.map((consumption) => ({
        raw_material: consumption.raw_material_batch.raw_material,
        batch_number: consumption.raw_material_batch.batch_number,
        quantity_consumed: consumption.quantity_consumed,
        unit: consumption.unit,
        receipt_date: consumption.raw_material_batch.receipt_date,
        expiry_date: consumption.raw_material_batch.expiry_date,
      })),
      field_applications: batch.applications.map((app) => ({
        application_id: app.id,
        app_number: app.app_number,
        app_date: app.app_date,
        app_type: app.app_type,
        quantity_used: app.quantity_used,
        trial: {
          id: app.trial.id,
          crop: app.trial.crop,
          village: app.trial.location?.village,
          farmer: app.trial.farmer,
          start_date: app.trial.start_date,
        },
      })),
    };

    res.json(traceability);
  } catch (error) {
    logger.error('Get batch traceability error:', error);
    res.status(500).json({ error: 'Failed to get batch traceability' });
  }
}

export async function getRawMaterialTraceability(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const rmBatch = await prisma.rawMaterialBatch.findUnique({
      where: { id },
      include: {
        raw_material: true,
        consumptions: {
          include: {
            finished_batch: {
              include: {
                product: true,
                applications: {
                  include: {
                    trial: {
                      include: {
                        farmer: {
                          select: {
                            id: true,
                            name: true,
                            location: {
                              select: {
                                village: true,
                                district: true,
                                state: true,
                                pincode: true,
                              },
                            },
                          },
                        },
                        location: {
                          select: {
                            village: true,
                            district: true,
                            state: true,
                            pincode: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!rmBatch) {
      return res.status(404).json({ error: 'Raw material batch not found' });
    }

    // Build forward traceability
    const traceability = {
      raw_material_batch: {
        id: rmBatch.id,
        batch_number: rmBatch.batch_number,
        raw_material: rmBatch.raw_material,
        receipt_date: rmBatch.receipt_date,
        expiry_date: rmBatch.expiry_date,
        quantity_received: rmBatch.quantity_received,
        quantity_remaining: rmBatch.quantity_remaining,
      },
      used_in_batches: rmBatch.consumptions.map((consumption) => ({
        finished_batch: {
          id: consumption.finished_batch.id,
          batch_number: consumption.finished_batch.batch_number,
          product: consumption.finished_batch.product,
          manufacturing_date: consumption.finished_batch.manufacturing_date,
        },
        quantity_consumed: consumption.quantity_consumed,
        unit: consumption.unit,
        field_trials: consumption.finished_batch.applications.map((app) => ({
          trial_id: app.trial.id,
          crop: app.trial.crop,
          village: app.trial.location?.village,
          farmer: app.trial.farmer,
          application_date: app.app_date,
          quantity_applied: app.quantity_used,
        })),
      })),
    };

    res.json(traceability);
  } catch (error) {
    logger.error('Get raw material traceability error:', error);
    res.status(500).json({ error: 'Failed to get raw material traceability' });
  }
}
