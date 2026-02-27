import express from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';

const router = express.Router();

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get user profile/settings
router.get('/profile', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
        id, email, full_name, business_name, address, phone, logo_url,
        default_currency, tax_number, bank_name, bank_account_number,
        bank_sort_code, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      businessName: user.business_name,
      address: user.address,
      phone: user.phone,
      logoUrl: user.logo_url,
      defaultCurrency: user.default_currency,
      taxNumber: user.tax_number,
      bankName: user.bank_name,
      bankAccountNumber: user.bank_account_number,
      bankSortCode: user.bank_sort_code,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/profile',
  [
    body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
    body('businessName').optional().trim(),
    body('address').optional().trim(),
    body('phone').optional().trim(),
    body('defaultCurrency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
    body('taxNumber').optional().trim(),
    body('bankName').optional().trim(),
    body('bankAccountNumber').optional().trim(),
    body('bankSortCode').optional().trim()
  ],
  validate,
  async (req, res, next) => {
    try {
      const {
        fullName,
        businessName,
        address,
        phone,
        defaultCurrency,
        taxNumber,
        bankName,
        bankAccountNumber,
        bankSortCode
      } = req.body;

      // Get current user data
      const currentResult = await query(
        'SELECT * FROM users WHERE id = $1',
        [req.userId]
      );

      if (currentResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const current = currentResult.rows[0];

      // Update user
      const result = await query(
        `UPDATE users SET
          full_name = $1,
          business_name = $2,
          address = $3,
          phone = $4,
          default_currency = $5,
          tax_number = $6,
          bank_name = $7,
          bank_account_number = $8,
          bank_sort_code = $9
         WHERE id = $10
         RETURNING id, email, full_name, business_name, address, phone, logo_url,
                   default_currency, tax_number, bank_name, bank_account_number,
                   bank_sort_code, created_at, updated_at`,
        [
          fullName ?? current.full_name,
          businessName ?? current.business_name,
          address ?? current.address,
          phone ?? current.phone,
          defaultCurrency ?? current.default_currency,
          taxNumber ?? current.tax_number,
          bankName ?? current.bank_name,
          bankAccountNumber ?? current.bank_account_number,
          bankSortCode ?? current.bank_sort_code,
          req.userId
        ]
      );

      const user = result.rows[0];

      res.json({
        message: 'Profile updated successfully',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          businessName: user.business_name,
          address: user.address,
          phone: user.phone,
          logoUrl: user.logo_url,
          defaultCurrency: user.default_currency,
          taxNumber: user.tax_number,
          bankName: user.bank_name,
          bankAccountNumber: user.bank_account_number,
          bankSortCode: user.bank_sort_code,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Change password
router.put('/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  validate,
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      // Get current user with password
      const result = await query(
        'SELECT id, password_hash FROM users WHERE id = $1',
        [req.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

      if (!isValidPassword) {
        return res.status(400).json({
          error: 'Invalid current password'
        });
      }

      // Hash new password
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [newPasswordHash, req.userId]
      );

      res.json({
        message: 'Password changed successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get invoice settings (number format, etc.)
router.get('/invoice', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT prefix, next_number, padding FROM invoice_sequences WHERE user_id = $1',
      [req.userId]
    );

    if (result.rows.length === 0) {
      // Create default sequence if not exists
      await query(
        'INSERT INTO invoice_sequences (user_id) VALUES ($1)',
        [req.userId]
      );
      return res.json({
        prefix: 'INV',
        nextNumber: 1,
        padding: 4,
        previewNumber: 'INV0001'
      });
    }

    const settings = result.rows[0];
    const previewNumber = settings.prefix +
      String(settings.next_number).padStart(settings.padding, '0');

    res.json({
      prefix: settings.prefix,
      nextNumber: settings.next_number,
      padding: settings.padding,
      previewNumber
    });
  } catch (error) {
    next(error);
  }
});

// Update invoice settings
router.put('/invoice',
  [
    body('prefix').optional().trim().isLength({ max: 20 }).withMessage('Prefix cannot exceed 20 characters'),
    body('padding').optional().isInt({ min: 1, max: 10 }).withMessage('Padding must be between 1 and 10')
  ],
  validate,
  async (req, res, next) => {
    try {
      const { prefix, padding } = req.body;

      // Get current settings
      const currentResult = await query(
        'SELECT * FROM invoice_sequences WHERE user_id = $1',
        [req.userId]
      );

      if (currentResult.rows.length === 0) {
        // Create sequence with provided values
        await query(
          'INSERT INTO invoice_sequences (user_id, prefix, padding) VALUES ($1, $2, $3)',
          [req.userId, prefix || 'INV', padding || 4]
        );
      } else {
        const current = currentResult.rows[0];
        await query(
          'UPDATE invoice_sequences SET prefix = $1, padding = $2 WHERE user_id = $3',
          [prefix ?? current.prefix, padding ?? current.padding, req.userId]
        );
      }

      // Get updated settings
      const result = await query(
        'SELECT prefix, next_number, padding FROM invoice_sequences WHERE user_id = $1',
        [req.userId]
      );

      const settings = result.rows[0];
      const previewNumber = settings.prefix +
        String(settings.next_number).padStart(settings.padding, '0');

      res.json({
        message: 'Invoice settings updated successfully',
        settings: {
          prefix: settings.prefix,
          nextNumber: settings.next_number,
          padding: settings.padding,
          previewNumber
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get user's invoice templates
router.get('/templates', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM invoice_templates WHERE user_id = $1 ORDER BY is_default DESC, name ASC',
      [req.userId]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Create a new template
router.post('/templates',
  [
    body('name').trim().notEmpty().withMessage('Template name is required'),
    body('primaryColor').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid color format'),
    body('isDefault').optional().isBoolean()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, primaryColor = '#4A5568', isDefault = false } = req.body;

      // If setting as default, unset other defaults
      if (isDefault) {
        await query(
          'UPDATE invoice_templates SET is_default = false WHERE user_id = $1',
          [req.userId]
        );
      }

      const result = await query(
        `INSERT INTO invoice_templates (user_id, name, primary_color, is_default)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [req.userId, name, primaryColor, isDefault]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Update a template
router.put('/templates/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Template name cannot be empty'),
    body('primaryColor').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Invalid color format'),
    body('isDefault').optional().isBoolean()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, primaryColor, isDefault } = req.body;

      // Check if template exists and belongs to user
      const existing = await query(
        'SELECT * FROM invoice_templates WHERE id = $1 AND user_id = $2',
        [id, req.userId]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const current = existing.rows[0];

      // If setting as default, unset other defaults
      if (isDefault) {
        await query(
          'UPDATE invoice_templates SET is_default = false WHERE user_id = $1 AND id != $2',
          [req.userId, id]
        );
      }

      const result = await query(
        `UPDATE invoice_templates SET
          name = $1,
          primary_color = $2,
          is_default = $3
         WHERE id = $4 AND user_id = $5
         RETURNING *`,
        [
          name ?? current.name,
          primaryColor ?? current.primary_color,
          isDefault ?? current.is_default,
          id,
          req.userId
        ]
      );

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a template
router.delete('/templates/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM invoice_templates WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
