import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

export async function createPricingRule(req: AuthRequest, res: Response) {
  try {
    const {
      raw_material_id,
      customer_id,
      min_quantity,
      max_quantity,
      unit_price,
      effective_from,
      effective_to,
    } = req.body;

    // Validate required fields
    if (!raw_material_id || !unit_price || !effective_from) {
      return res.status(400).json({
        error: 'Raw material, unit price, and effective from date are required',
      });
    }

    // Validate raw material exists
    const rawMaterial = await prisma.rawMaterial.findUnique({
      where: { id: raw_material_id },
    });

    if (!rawMaterial) {
      return res.status(404).json({ error: 'Raw material not found' });
    }

    // Validate customer if provided
    if (customer_id) {
      const customer = await prisma.customer.findUnique({
        where: { id: customer_id },
      });

      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
    }

    // Validate quantity range
    if (min_quantity && max_quantity && Number(min_quantity) > Number(max_quantity)) {
      return res.status(400).json({
        error: 'Minimum quantity cannot be greater than maximum quantity',
      });
    }

    // Check for overlapping rules
    const overlappingRule = await prisma.pricingRule.findFirst({
      where: {
        raw_material_id,
        customer_id: customer_id || null,
        is_active: true,
        OR: [
          {
            AND: [
              {
                effective_from: {
                  lte: new Date(effective_from),
                },
              },
              {
                OR: [
                  { effective_to: null },
                  {
                    effective_to: {
                      gte: new Date(effective_from),
                    },
                  },
                ],
              },
            ],
          },
          effective_to
            ? {
                AND: [
                  {
                    effective_from: {
                      lte: new Date(effective_to),
                    },
                  },
                  {
                    OR: [
                      { effective_to: null },
                      {
                        effective_to: {
                          gte: new Date(effective_to),
                        },
                      },
                    ],
                  },
                ],
              }
            : {},
        ],
      },
    });

    if (overlappingRule) {
      return res.status(400).json({
        error: 'A pricing rule already exists for this period and configuration',
      });
    }

    // Create pricing rule
    const pricingRule = await prisma.pricingRule.create({
      data: {
        raw_material_id,
        customer_id: customer_id || null,
        min_quantity: min_quantity || null,
        max_quantity: max_quantity || null,
        unit_price: Number(unit_price),
        effective_from: new Date(effective_from),
        effective_to: effective_to ? new Date(effective_to) : null,
      },
      include: {
        raw_material: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            company_name: true,
          },
        },
      },
    });

    logger.info('Pricing rule created', { pricing_rule_id: pricingRule.id });
    res.status(201).json({ pricingRule });
  } catch (error: any) {
    logger.error('Create pricing rule error:', error);
    res.status(500).json({ error: error.message || 'Failed to create pricing rule' });
  }
}

export async function getPricingRules(req: AuthRequest, res: Response) {
  try {
    const {
      raw_material_id,
      customer_id,
      is_active,
      effective_date,
      page = '1',
      limit = '20',
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    if (raw_material_id) {
      where.raw_material_id = String(raw_material_id);
    }

    if (customer_id) {
      where.customer_id = String(customer_id);
    }

    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }

    if (effective_date) {
      where.effective_from = {
        lte: new Date(String(effective_date)),
      };
      where.OR = [
        { effective_to: null },
        {
          effective_to: {
            gte: new Date(String(effective_date)),
          },
        },
      ];
    }

    const [pricingRules, total] = await Promise.all([
      prisma.pricingRule.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          raw_material: {
            select: {
              id: true,
              name: true,
            },
          },
          customer: {
            select: {
              id: true,
              company_name: true,
            },
          },
        },
      }),
      prisma.pricingRule.count({ where }),
    ]);

    res.json({
      pricingRules,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error('Get pricing rules error:', error);
    res.status(500).json({ error: 'Failed to get pricing rules' });
  }
}

export async function getPricingRuleById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const pricingRule = await prisma.pricingRule.findUnique({
      where: { id },
      include: {
        raw_material: true,
        customer: true,
      },
    });

    if (!pricingRule) {
      return res.status(404).json({ error: 'Pricing rule not found' });
    }

    res.json({ pricingRule });
  } catch (error) {
    logger.error('Get pricing rule by ID error:', error);
    res.status(500).json({ error: 'Failed to get pricing rule' });
  }
}

export async function updatePricingRule(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { min_quantity, max_quantity, unit_price, effective_to, is_active } = req.body;

    // Check if pricing rule exists
    const existingRule = await prisma.pricingRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Pricing rule not found' });
    }

    // Validate quantity range if provided
    if (min_quantity && max_quantity && Number(min_quantity) > Number(max_quantity)) {
      return res.status(400).json({
        error: 'Minimum quantity cannot be greater than maximum quantity',
      });
    }

    const updateData: any = {};
    if (min_quantity !== undefined) updateData.min_quantity = min_quantity;
    if (max_quantity !== undefined) updateData.max_quantity = max_quantity;
    if (unit_price !== undefined) updateData.unit_price = Number(unit_price);
    if (effective_to !== undefined)
      updateData.effective_to = effective_to ? new Date(effective_to) : null;
    if (is_active !== undefined) updateData.is_active = is_active;

    const pricingRule = await prisma.pricingRule.update({
      where: { id },
      data: updateData,
      include: {
        raw_material: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            company_name: true,
          },
        },
      },
    });

    logger.info('Pricing rule updated', { pricing_rule_id: id });
    res.json({ pricingRule });
  } catch (error) {
    logger.error('Update pricing rule error:', error);
    res.status(500).json({ error: 'Failed to update pricing rule' });
  }
}

export async function deletePricingRule(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if pricing rule exists
    const existingRule = await prisma.pricingRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Pricing rule not found' });
    }

    await prisma.pricingRule.delete({
      where: { id },
    });

    logger.info('Pricing rule deleted', { pricing_rule_id: id });
    res.json({ message: 'Pricing rule deleted successfully' });
  } catch (error) {
    logger.error('Delete pricing rule error:', error);
    res.status(500).json({ error: 'Failed to delete pricing rule' });
  }
}

// Helper function to calculate price based on rules
export async function getApplicablePrice(req: AuthRequest, res: Response) {
  try {
    const { raw_material_id, customer_id, quantity, date } = req.query;

    if (!raw_material_id || !quantity) {
      return res.status(400).json({
        error: 'Raw material ID and quantity are required',
      });
    }

    const effectiveDate = date ? new Date(String(date)) : new Date();
    const qty = Number(quantity);

    // Find applicable pricing rules with priority:
    // 1. Customer-specific + quantity range match
    // 2. Customer-specific + no quantity range
    // 3. General + quantity range match
    // 4. General + no quantity range

    const rules = await prisma.pricingRule.findMany({
      where: {
        raw_material_id: String(raw_material_id),
        is_active: true,
        effective_from: {
          lte: effectiveDate,
        },
        OR: [
          { effective_to: null },
          {
            effective_to: {
              gte: effectiveDate,
            },
          },
        ],
      },
      include: {
        raw_material: {
          select: {
            name: true,
          },
        },
        customer: {
          select: {
            company_name: true,
          },
        },
      },
      orderBy: [{ customer_id: 'desc' }, { min_quantity: 'desc' }],
    });

    if (rules.length === 0) {
      return res.status(404).json({
        error: 'No pricing rule found for the given parameters',
      });
    }

    // Filter and prioritize rules
    let applicableRule = null;

    // Priority 1: Customer-specific + quantity range match
    if (customer_id) {
      applicableRule = rules.find(
        (rule) =>
          rule.customer_id === String(customer_id) &&
          rule.min_quantity !== null &&
          rule.max_quantity !== null &&
          Number(rule.min_quantity) <= qty &&
          Number(rule.max_quantity) >= qty
      );
    }

    // Priority 2: Customer-specific + no quantity range
    if (!applicableRule && customer_id) {
      applicableRule = rules.find(
        (rule) =>
          rule.customer_id === String(customer_id) &&
          (rule.min_quantity === null || Number(rule.min_quantity) <= qty) &&
          (rule.max_quantity === null || Number(rule.max_quantity) >= qty)
      );
    }

    // Priority 3: General + quantity range match
    if (!applicableRule) {
      applicableRule = rules.find(
        (rule) =>
          rule.customer_id === null &&
          rule.min_quantity !== null &&
          rule.max_quantity !== null &&
          Number(rule.min_quantity) <= qty &&
          Number(rule.max_quantity) >= qty
      );
    }

    // Priority 4: General + no quantity range
    if (!applicableRule) {
      applicableRule = rules.find(
        (rule) =>
          rule.customer_id === null &&
          (rule.min_quantity === null || Number(rule.min_quantity) <= qty) &&
          (rule.max_quantity === null || Number(rule.max_quantity) >= qty)
      );
    }

    if (!applicableRule) {
      return res.status(404).json({
        error: 'No applicable pricing rule found for the given quantity',
      });
    }

    res.json({
      pricingRule: applicableRule,
      unitPrice: Number(applicableRule.unit_price),
      totalPrice: Number(applicableRule.unit_price) * qty,
    });
  } catch (error) {
    logger.error('Get applicable price error:', error);
    res.status(500).json({ error: 'Failed to calculate price' });
  }
}
