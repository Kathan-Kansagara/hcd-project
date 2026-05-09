import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function createFarmer(req: AuthRequest, res: Response) {
  try {
    const { name, contact, village, city, district, state, pincode } = req.body;

    // Validate required fields
    if (!name || !village) {
      return res.status(400).json({ error: 'Name and village are required' });
    }

    // Create or find location if location fields are provided
    let location_id = null;
    if (village || city || district || state || pincode) {
      const location = await prisma.location.create({
        data: {
          village: village || null,
          city: city || null,
          district: district || null,
          state: state || null,
          pincode: pincode || null,
        },
      });
      location_id = location.id;
    }

    const farmer = await prisma.farmer.create({
      data: {
        name,
        contact,
        location_id,
        created_by: req.user!.userId,
      },
      include: {
        location: true,
      },
    });

    // Flatten location data for backwards compatibility
    const farmerWithFlatLocation = {
      ...farmer,
      village: farmer.location?.village || null,
      city: farmer.location?.city || null,
      district: farmer.location?.district || null,
      state: farmer.location?.state || null,
      pincode: farmer.location?.pincode || null,
    };

    res.status(201).json({ farmer: farmerWithFlatLocation });
  } catch (error) {
    logger.error('Create farmer error:', error);
    res.status(500).json({ error: 'Failed to create farmer' });
  }
}

export async function getFarmers(req: AuthRequest, res: Response) {
  try {
    const { search, district, state, page = '1', limit = '20', include_archived = 'false', sortBy, sortOrder } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    // By default, exclude archived farmers
    if (include_archived !== 'true') {
      where.is_archived = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { contact: { contains: String(search) } },
        { location: { village: { contains: String(search), mode: 'insensitive' } } },
        { location: { city: { contains: String(search), mode: 'insensitive' } } },
        { location: { district: { contains: String(search), mode: 'insensitive' } } },
        { location: { state: { contains: String(search), mode: 'insensitive' } } },
        { location: { pincode: { contains: String(search) } } },
      ];
    }

    if (district) {
      where.location = {
        ...where.location,
        district: { contains: String(district), mode: 'insensitive' },
      };
    }

    if (state) {
      where.location = {
        ...where.location,
        state: { contains: String(state), mode: 'insensitive' },
      };
    }

    // Server-side sorting
    const sortDir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';
    const sortFieldMap: Record<string, any> = {
      name: { name: sortDir },
      contact: { contact: sortDir },
      created_at: { created_at: sortDir },
    };
    const orderBy = sortFieldMap[String(sortBy || '')] || { created_at: 'desc' };

    const [farmers, total] = await Promise.all([
      prisma.farmer.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          name: true,
          contact: true,
          location: {
            select: {
              village: true,
              city: true,
              district: true,
              state: true,
              pincode: true,
            },
          },
          created_at: true,
          updated_at: true,
          creator: { select: { id: true, name: true } },
          updater: { select: { id: true, name: true } },
        },
      }),
      prisma.farmer.count({ where }),
    ]);

    // Flatten location data for backwards compatibility
    const farmersWithFlatLocation = farmers.map(farmer => ({
      ...farmer,
      village: farmer.location?.village || null,
      city: farmer.location?.city || null,
      district: farmer.location?.district || null,
      state: farmer.location?.state || null,
      pincode: farmer.location?.pincode || null,
    }));

    res.json({
      farmers: farmersWithFlatLocation,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get farmers error:', error);
    res.status(500).json({ error: 'Failed to get farmers' });
  }
}

export async function getFarmerById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const farmer = await prisma.farmer.findUnique({
      where: { id },
      include: {
        location: true,
        trials: {
          select: {
            id: true,
            crop: true,
            start_date: true,
            status: true,
          },
          orderBy: { start_date: 'desc' },
        },
      },
    });

    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    // Flatten location data for backwards compatibility
    const farmerWithFlatLocation = {
      ...farmer,
      village: farmer.location?.village || null,
      city: farmer.location?.city || null,
      district: farmer.location?.district || null,
      state: farmer.location?.state || null,
      pincode: farmer.location?.pincode || null,
    };

    res.json({ farmer: farmerWithFlatLocation });
  } catch (error) {
    logger.error('Get farmer by ID error:', error);
    res.status(500).json({ error: 'Failed to get farmer' });
  }
}

export async function updateFarmer(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, contact, village, city, district, state, pincode } = req.body;

    // Check if farmer exists
    const existingFarmer = await prisma.farmer.findUnique({
      where: { id },
      include: { location: true }
    });
    if (!existingFarmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    const updateData: any = {
      updated_by: req.user!.userId,
    };

    if (name !== undefined) updateData.name = name;
    if (contact !== undefined) updateData.contact = contact;

    // Handle location updates
    if (village !== undefined || city !== undefined || district !== undefined || state !== undefined || pincode !== undefined) {
      if (existingFarmer.location_id) {
        // Update existing location
        await prisma.location.update({
          where: { id: existingFarmer.location_id },
          data: {
            ...(village !== undefined && { village }),
            ...(city !== undefined && { city }),
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
            district: district || null,
            state: state || null,
            pincode: pincode || null,
          },
        });
        updateData.location_id = location.id;
      }
    }

    const farmer = await prisma.farmer.update({
      where: { id },
      data: updateData,
      include: {
        location: true,
      },
    });

    // Flatten location data for backwards compatibility
    const farmerWithFlatLocation = {
      ...farmer,
      village: farmer.location?.village || null,
      city: farmer.location?.city || null,
      district: farmer.location?.district || null,
      state: farmer.location?.state || null,
      pincode: farmer.location?.pincode || null,
    };

    res.json({ farmer: farmerWithFlatLocation });
  } catch (error) {
    logger.error('Update farmer error:', error);
    res.status(500).json({ error: 'Failed to update farmer' });
  }
}

export async function archiveFarmer(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if farmer exists
    const farmer = await prisma.farmer.findUnique({ where: { id } });

    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    if (farmer.is_archived) {
      return res.status(400).json({ error: 'Farmer is already archived' });
    }

    const archivedFarmer = await prisma.farmer.update({
      where: { id },
      data: {
        is_archived: true,
        archived_at: new Date(),
        updated_by: req.user!.userId,
      },
    });

    res.json({ message: 'Farmer archived successfully', farmer: archivedFarmer });
  } catch (error) {
    logger.error('Archive farmer error:', error);
    res.status(500).json({ error: 'Failed to archive farmer' });
  }
}

export async function unarchiveFarmer(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if farmer exists
    const farmer = await prisma.farmer.findUnique({ where: { id } });

    if (!farmer) {
      return res.status(404).json({ error: 'Farmer not found' });
    }

    if (!farmer.is_archived) {
      return res.status(400).json({ error: 'Farmer is not archived' });
    }

    const unarchivedFarmer = await prisma.farmer.update({
      where: { id },
      data: {
        is_archived: false,
        archived_at: null,
        updated_by: req.user!.userId,
      },
    });

    res.json({ message: 'Farmer unarchived successfully', farmer: unarchivedFarmer });
  } catch (error) {
    logger.error('Unarchive farmer error:', error);
    res.status(500).json({ error: 'Failed to unarchive farmer' });
  }
}

export async function getFarmerLocations(req: AuthRequest, res: Response) {
  try {
    const { type } = req.params; // village, city, district, state

    const validTypes = ['village', 'city', 'district', 'state'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid location type' });
    }

    const locations = await prisma.location.findMany({
      where: {
        farmers: {
          some: {},
        },
      },
      select: {
        [type]: true,
      },
      distinct: [type] as any,
      orderBy: {
        [type]: 'asc',
      },
    });

    const locationList = locations
      .map((l: any) => l[type])
      .filter((l: any): l is string => l !== null);

    res.json({ locations: locationList });
  } catch (error) {
    logger.error('Get farmer locations error:', error);
    res.status(500).json({ error: 'Failed to get locations' });
  }
}

export async function getLocationDetails(req: AuthRequest, res: Response) {
  try {
    const { village } = req.query;

    if (!village) {
      return res.status(400).json({ error: 'Village is required' });
    }

    // Find the most recent location with this village
    const location = await prisma.location.findFirst({
      where: {
        village: {
          equals: String(village),
          mode: 'insensitive',
        },
        farmers: {
          some: {},
        },
      },
      select: {
        village: true,
        city: true,
        district: true,
        state: true,
        pincode: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    if (!location) {
      return res.status(404).json({ error: 'Village not found' });
    }

    res.json({ location });
  } catch (error) {
    logger.error('Get location details error:', error);
    res.status(500).json({ error: 'Failed to get location details' });
  }
}
