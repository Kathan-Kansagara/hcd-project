import { Response } from 'express';
import { prisma } from '@zenon/database';
import { AuthRequest } from '../middleware/auth.middleware.js';
import logger from '../config/logger.js';

/**
 * Validates GSTIN format (15 characters alphanumeric)
 * Format: 2 digits (state code) + 10 alphanumeric (PAN) + 1 digit + 1 alphabet + 1 alphabet/digit
 */
function validateGSTIN(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin);
}

/**
 * Validates IFSC code format (11 characters)
 * Format: 4 letters (bank code) + 0 + 6 alphanumeric (branch code)
 */
function validateIFSC(ifsc: string): boolean {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc);
}

/**
 * Get company settings
 * GET /api/v1/company-settings
 */
export async function getSettings(req: AuthRequest, res: Response) {
  try {
    // Get the first (and should be only) company settings record
    const settings = await prisma.companySettings.findFirst();

    if (!settings) {
      return res.status(404).json({ error: 'Company settings not found' });
    }

    res.json(settings);
  } catch (error) {
    logger.error('Get company settings error:', error);
    res.status(500).json({ error: 'Failed to get company settings' });
  }
}

/**
 * Update company settings
 * PUT /api/v1/company-settings
 * Requires ADMIN role
 */
export async function updateSettings(req: AuthRequest, res: Response) {
  try {
    const {
      company_name,
      address_line1,
      address_line2,
      city,
      state,
      pincode,
      gstin,
      fssai_number,
      bank_name,
      bank_account_number,
      ifsc_code,
      invoice_terms_and_conditions,
      invoice_prefix,
      logo_path,
    } = req.body;

    // Validate required fields
    if (company_name !== undefined && !company_name.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    if (address_line1 !== undefined && !address_line1.trim()) {
      return res.status(400).json({ error: 'Address line 1 is required' });
    }

    if (city !== undefined && !city.trim()) {
      return res.status(400).json({ error: 'City is required' });
    }

    if (state !== undefined && !state.trim()) {
      return res.status(400).json({ error: 'State is required' });
    }

    if (pincode !== undefined && !pincode.trim()) {
      return res.status(400).json({ error: 'Pincode is required' });
    }

    if (gstin !== undefined && !gstin.trim()) {
      return res.status(400).json({ error: 'GSTIN is required' });
    }

    if (bank_name !== undefined && !bank_name.trim()) {
      return res.status(400).json({ error: 'Bank name is required' });
    }

    if (bank_account_number !== undefined && !bank_account_number.trim()) {
      return res.status(400).json({ error: 'Bank account number is required' });
    }

    if (ifsc_code !== undefined && !ifsc_code.trim()) {
      return res.status(400).json({ error: 'IFSC code is required' });
    }

    if (invoice_terms_and_conditions !== undefined && !invoice_terms_and_conditions.trim()) {
      return res.status(400).json({ error: 'Invoice terms and conditions are required' });
    }

    // Validate GSTIN format if provided
    if (gstin && !validateGSTIN(gstin)) {
      return res.status(400).json({
        error: 'Invalid GSTIN format. GSTIN must be 15 characters in format: 2 digits + 10 alphanumeric + 1 digit + 1 alphabet + Z + 1 alphanumeric'
      });
    }

    // Validate IFSC code format if provided
    if (ifsc_code && !validateIFSC(ifsc_code)) {
      return res.status(400).json({
        error: 'Invalid IFSC code format. IFSC must be 11 characters in format: 4 letters + 0 + 6 alphanumeric'
      });
    }

    // Get existing settings
    const existingSettings = await prisma.companySettings.findFirst();

    if (!existingSettings) {
      return res.status(404).json({ error: 'Company settings not found' });
    }

    // Build update data object with only provided fields
    const updateData: any = {};

    if (company_name !== undefined) updateData.company_name = company_name;
    if (address_line1 !== undefined) updateData.address_line1 = address_line1;
    if (address_line2 !== undefined) updateData.address_line2 = address_line2;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (pincode !== undefined) updateData.pincode = pincode;
    if (gstin !== undefined) updateData.gstin = gstin;
    if (fssai_number !== undefined) updateData.fssai_number = fssai_number;
    if (bank_name !== undefined) updateData.bank_name = bank_name;
    if (bank_account_number !== undefined) updateData.bank_account_number = bank_account_number;
    if (ifsc_code !== undefined) updateData.ifsc_code = ifsc_code;
    if (invoice_terms_and_conditions !== undefined) updateData.invoice_terms_and_conditions = invoice_terms_and_conditions;
    if (invoice_prefix !== undefined) updateData.invoice_prefix = invoice_prefix;
    if (logo_path !== undefined) updateData.logo_path = logo_path;

    // Update settings
    const updatedSettings = await prisma.companySettings.update({
      where: { id: existingSettings.id },
      data: updateData,
    });

    logger.info('Company settings updated', {
      userId: req.user!.userId,
      settingsId: updatedSettings.id,
    });

    res.json(updatedSettings);
  } catch (error) {
    logger.error('Update company settings error:', error);
    res.status(500).json({ error: 'Failed to update company settings' });
  }
}
