import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function createTrial(req: AuthRequest, res: Response) {
  try {
    const {
      farmer_id,
      product_id,
      crop,
      village,
      city,
      taluka,
      district,
      state,
      pincode,
      season,
      start_date,
      status,
      gps_lat,
      gps_lng,
      with_other_products,
      yield_value,
      yield_unit,
      final_comments,
    } = req.body;

    // Validate required fields
    if (!farmer_id || !product_id || !crop || !village || !start_date) {
      return res.status(400).json({
        error: 'Farmer, product, crop, village, and start date are required',
      });
    }

    // Verify farmer exists
    const farmer = await prisma.farmer.findUnique({ where: { id: farmer_id } });
    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: product_id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Create location if location fields are provided
    let location_id = null;
    if (village || city || taluka || district || state || pincode) {
      const location = await prisma.location.create({
        data: {
          village: village || null,
          city: city || null,
          taluka: taluka || null,
          district: district || null,
          state: state || null,
          pincode: pincode || null,
        },
      });
      location_id = location.id;
    }

    const trial = await prisma.trial.create({
      data: {
        farmer_id,
        product_id,
        location_id,
        crop,
        season,
        start_date: new Date(start_date),
        status: status || 'DRAFT',
        gps_lat,
        gps_lng,
        with_other_products,
        yield_value,
        yield_unit,
        comments: final_comments,
        created_by: req.user!.userId,
      },
      include: {
        location: true,
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
            category: true,
          },
        },
      },
    });

    // Flatten location data for backwards compatibility
    const trialWithFlatLocation = {
      ...trial,
      village: trial.location?.village || null,
      city: trial.location?.city || null,
      taluka: trial.location?.taluka || null,
      district: trial.location?.district || null,
      state: trial.location?.state || null,
      pincode: trial.location?.pincode || null,
      farmer: {
        ...trial.farmer,
        village: trial.farmer.location?.village || null,
      },
    };

    res.status(201).json({ trial: trialWithFlatLocation });
  } catch (error) {
    logger.error('Create trial error:', error);
    res.status(500).json({ error: 'Failed to create trial' });
  }
}

export async function getTrials(req: AuthRequest, res: Response) {
  try {
    const {
      farmer_id,
      product_id,
      status,
      village,
      crop,
      season,
      start_date_from,
      start_date_to,
      show_archived,
      page = '1',
      limit = '20',
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    if (farmer_id) where.farmer_id = String(farmer_id);
    if (product_id) where.product_id = String(product_id);
    if (village) {
      where.location = {
        ...where.location,
        village: { contains: String(village), mode: 'insensitive' },
      };
    }
    if (crop) where.crop = { contains: String(crop), mode: 'insensitive' };
    if (season) where.season = { contains: String(season), mode: 'insensitive' };

    if (start_date_from || start_date_to) {
      where.start_date = {};
      if (start_date_from) where.start_date.gte = new Date(String(start_date_from));
      if (start_date_to) where.start_date.lte = new Date(String(start_date_to));
    }

    // Handle status filtering with archived logic
    if (show_archived === 'true' && req.user!.role === 'ADMIN') {
      // ADMIN viewing archived trials only
      where.status = 'ARCHIVED';
      logger.info('Showing archived trials only');
    } else if (status) {
      // Specific status requested
      where.status = String(status);
      logger.info('Filtering by status:', status);
    } else {
      // Default: exclude archived trials - use NOT operator
      where.NOT = { status: 'ARCHIVED' };
      logger.info('Excluding archived trials');
    }

    logger.info('Final where clause:', where);

    const [trials, total] = await Promise.all([
      prisma.trial.findMany({
        where,
        skip,
        take,
        orderBy: { start_date: 'desc' },
        include: {
          location: true,
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
              category: true,
            },
          },
          creator: { select: { id: true, name: true } },
          updater: { select: { id: true, name: true } },
          applications: {
            select: {
              id: true,
              app_number: true,
              app_type: true,
              app_date: true,
              status: true,
            },
            orderBy: { app_number: 'asc' },
          },
        },
      }),
      prisma.trial.count({ where }),
    ]);

    // Flatten location data for backwards compatibility
    const trialsWithFlatLocation = trials.map(trial => ({
      ...trial,
      village: trial.location?.village || null,
      city: trial.location?.city || null,
      taluka: trial.location?.taluka || null,
      district: trial.location?.district || null,
      state: trial.location?.state || null,
      pincode: trial.location?.pincode || null,
      farmer: {
        ...trial.farmer,
        village: trial.farmer.location?.village || null,
      },
    }));

    res.json({
      trials: trialsWithFlatLocation,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get trials error:', error);
    res.status(500).json({ error: 'Failed to get trials' });
  }
}

export async function getTrialById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const trial = await prisma.trial.findUnique({
      where: { id },
      include: {
        location: true,
        farmer: {
          select: {
            id: true,
            name: true,
            contact: true,
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
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
          },
        },
        applications: {
          include: {
            photos: {
              orderBy: { created_at: 'asc' },
            },
            batch: {
              select: {
                id: true,
                batch_number: true,
                unit: true,
              },
            },
          },
          orderBy: { app_number: 'asc' },
        },
      },
    });

    if (!trial) {
      return res.status(404).json({ error: 'Trial not found' });
    }

    // Flatten location data for backwards compatibility
    const trialWithFlatLocation = {
      ...trial,
      village: trial.location?.village || null,
      city: trial.location?.city || null,
      taluka: trial.location?.taluka || null,
      district: trial.location?.district || null,
      state: trial.location?.state || null,
      pincode: trial.location?.pincode || null,
      farmer: {
        ...trial.farmer,
        village: trial.farmer.location?.village || null,
        district: trial.farmer.location?.district || null,
        state: trial.farmer.location?.state || null,
        pincode: trial.farmer.location?.pincode || null,
      },
    };

    res.json({ trial: trialWithFlatLocation });
  } catch (error) {
    logger.error('Get trial by ID error:', error);
    res.status(500).json({ error: 'Failed to get trial' });
  }
}

export async function updateTrial(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const {
      crop,
      village,
      city,
      taluka,
      district,
      state,
      pincode,
      season,
      start_date,
      status,
      gps_lat,
      gps_lng,
      with_other_products,
      yield_value,
      yield_unit,
      comments,
      rating,
      is_successful,
    } = req.body;

    // Check if trial exists
    const existingTrial = await prisma.trial.findUnique({
      where: { id },
      include: { location: true }
    });
    if (!existingTrial) {
      return res.status(404).json({ error: 'Trial not found' });
    }

    // Only ADMIN can edit completed trials
    if (existingTrial.status === 'COMPLETED' && req.user!.role !== 'ADMIN') {
      return res.status(403).json({
        error: 'Only administrators can edit completed trials'
      });
    }

    const updateData: any = {
      updated_by: req.user!.userId,
    };

    if (crop !== undefined) updateData.crop = crop;
    if (season !== undefined) updateData.season = season;
    if (start_date !== undefined) updateData.start_date = new Date(start_date);
    if (status !== undefined) updateData.status = status;
    if (gps_lat !== undefined) updateData.gps_lat = gps_lat;
    if (gps_lng !== undefined) updateData.gps_lng = gps_lng;
    if (with_other_products !== undefined) updateData.with_other_products = with_other_products;
    if (yield_value !== undefined) updateData.yield_value = yield_value;
    if (yield_unit !== undefined) updateData.yield_unit = yield_unit;
    if (comments !== undefined) updateData.comments = comments;
    if (rating !== undefined) updateData.rating = rating;
    if (is_successful !== undefined) updateData.is_successful = is_successful;

    // Handle location updates
    if (village !== undefined || city !== undefined || taluka !== undefined || district !== undefined || state !== undefined || pincode !== undefined) {
      if (existingTrial.location_id) {
        // Update existing location
        await prisma.location.update({
          where: { id: existingTrial.location_id },
          data: {
            ...(village !== undefined && { village }),
            ...(city !== undefined && { city }),
            ...(taluka !== undefined && { taluka }),
            ...(district !== undefined && { district }),
            ...(state !== undefined && { state }),
            ...(pincode !== undefined && { pincode }),
          },
        });
      } else {
        // Create new location
        const location = await prisma.location.create({
          data: {
            village: village || null,
            city: city || null,
            taluka: taluka || null,
            district: district || null,
            state: state || null,
            pincode: pincode || null,
          },
        });
        updateData.location_id = location.id;
      }
    }

    const trial = await prisma.trial.update({
      where: { id },
      data: updateData,
      include: {
        location: true,
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
            category: true,
          },
        },
      },
    });

    // Flatten location data for backwards compatibility
    const trialWithFlatLocation = {
      ...trial,
      village: trial.location?.village || null,
      city: trial.location?.city || null,
      taluka: trial.location?.taluka || null,
      district: trial.location?.district || null,
      state: trial.location?.state || null,
      pincode: trial.location?.pincode || null,
      farmer: {
        ...trial.farmer,
        village: trial.farmer.location?.village || null,
      },
    };

    res.json({ trial: trialWithFlatLocation });
  } catch (error) {
    logger.error('Update trial error:', error);
    res.status(500).json({ error: 'Failed to update trial' });
  }
}

export async function deleteTrial(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if trial exists
    const trial = await prisma.trial.findUnique({
      where: { id },
      include: {
        applications: { select: { id: true } },
      },
    });

    if (!trial) {
      return res.status(404).json({ error: 'Trial not found' });
    }

    // Check if already archived
    if (trial.status === 'ARCHIVED') {
      return res.status(400).json({ error: 'Trial is already archived' });
    }

    // Archive trial by changing status
    await prisma.trial.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        updated_by: req.user!.userId,
      },
    });

    res.json({
      message: 'Trial archived successfully',
      archivedApplications: trial.applications.length,
    });
  } catch (error) {
    logger.error('Delete trial error:', error);
    res.status(500).json({ error: 'Failed to archive trial' });
  }
}

export async function getTrialFilterOptions(req: AuthRequest, res: Response) {
  try {
    // Use groupBy for more reliable distinct values
    const [cropGroups, seasonGroups, villageGroups] = await Promise.all([
      prisma.trial.groupBy({
        by: ['crop'],
        orderBy: { crop: 'asc' },
      }),
      prisma.trial.groupBy({
        by: ['season'],
        where: { season: { not: null } },
        orderBy: { season: 'asc' },
      }),
      prisma.location.groupBy({
        by: ['village'],
        where: {
          AND: [
            { village: { not: null } },
            {
              trials: {
                some: {},
              },
            },
          ],
        },
        orderBy: { village: 'asc' },
      }),
    ]);

    res.json({
      crops: cropGroups.map((g) => g.crop),
      seasons: seasonGroups.map((g) => g.season).filter(Boolean),
      villages: villageGroups.map((g) => g.village).filter(Boolean),
    });
  } catch (error) {
    logger.error('Get trial filter options error:', error);
    res.status(500).json({ error: 'Failed to get filter options' });
  }
}
