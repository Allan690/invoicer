import { Router } from 'express';
import { query } from '../db/index.js';
import { body, param, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Client validation rules
const clientValidation = [
  body('name').trim().notEmpty().withMessage('Client name is required'),
  body('email').optional({ nullable: true }).isEmail().withMessage('Invalid email format'),
  body('phone').optional({ nullable: true }).trim(),
  body('address').optional({ nullable: true }).trim(),
  body('company_name').optional({ nullable: true }).trim(),
  body('tax_number').optional({ nullable: true }).trim(),
  body('notes').optional({ nullable: true }).trim(),
];

// GET /api/clients - Get all clients for the user
router.get('/', async (req, res, next) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT
        c.*,
        COUNT(i.id) as invoice_count,
        COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN i.total ELSE 0 END), 0) as total_billed,
        COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN i.balance_due ELSE 0 END), 0) as total_outstanding
      FROM clients c
      LEFT JOIN invoices i ON c.id = i.client_id
      WHERE c.user_id = $1
    `;
    const params = [req.userId];
    let paramIndex = 2;

    if (search) {
      queryText += ` AND (c.name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.company_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    queryText += `
      GROUP BY c.id
      ORDER BY c.name ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM clients WHERE user_id = $1';
    const countParams = [req.userId];
    if (search) {
      countQuery += ' AND (name ILIKE $2 OR email ILIKE $2 OR company_name ILIKE $2)';
      countParams.push(`%${search}%`);
    }
    const countResult = await query(countQuery, countParams);

    res.json({
      clients: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/clients/:id - Get a single client
router.get('/:id',
  param('id').isUUID().withMessage('Invalid client ID'),
  validate,
  async (req, res, next) => {
    try {
      const result = await query(
        `SELECT
          c.*,
          COUNT(i.id) as invoice_count,
          COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN i.total ELSE 0 END), 0) as total_billed,
          COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN i.balance_due ELSE 0 END), 0) as total_outstanding
        FROM clients c
        LEFT JOIN invoices i ON c.id = i.client_id
        WHERE c.id = $1 AND c.user_id = $2
        GROUP BY c.id`,
        [req.params.id, req.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/clients - Create a new client
router.post('/',
  clientValidation,
  validate,
  async (req, res, next) => {
    try {
      const { name, email, phone, address, company_name, tax_number, notes } = req.body;

      const result = await query(
        `INSERT INTO clients (user_id, name, email, phone, address, company_name, tax_number, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [req.userId, name, email || null, phone || null, address || null, company_name || null, tax_number || null, notes || null]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/clients/:id - Update a client
router.put('/:id',
  param('id').isUUID().withMessage('Invalid client ID'),
  clientValidation,
  validate,
  async (req, res, next) => {
    try {
      const { name, email, phone, address, company_name, tax_number, notes } = req.body;

      // First check if client belongs to user
      const existingClient = await query(
        'SELECT id FROM clients WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]
      );

      if (existingClient.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const result = await query(
        `UPDATE clients
         SET name = $1, email = $2, phone = $3, address = $4, company_name = $5, tax_number = $6, notes = $7
         WHERE id = $8 AND user_id = $9
         RETURNING *`,
        [name, email || null, phone || null, address || null, company_name || null, tax_number || null, notes || null, req.params.id, req.userId]
      );

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/clients/:id - Delete a client
router.delete('/:id',
  param('id').isUUID().withMessage('Invalid client ID'),
  validate,
  async (req, res, next) => {
    try {
      // Check if client has invoices
      const invoiceCheck = await query(
        'SELECT COUNT(*) FROM invoices WHERE client_id = $1',
        [req.params.id]
      );

      if (parseInt(invoiceCheck.rows[0].count) > 0) {
        return res.status(400).json({
          error: 'Cannot delete client with existing invoices. Delete or reassign invoices first.'
        });
      }

      const result = await query(
        'DELETE FROM clients WHERE id = $1 AND user_id = $2 RETURNING id',
        [req.params.id, req.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }

      res.json({ message: 'Client deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/clients/:id/invoices - Get all invoices for a client
router.get('/:id/invoices',
  param('id').isUUID().withMessage('Invalid client ID'),
  validate,
  async (req, res, next) => {
    try {
      // First verify client belongs to user
      const clientCheck = await query(
        'SELECT id FROM clients WHERE id = $1 AND user_id = $2',
        [req.params.id, req.userId]
      );

      if (clientCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const result = await query(
        `SELECT * FROM invoices
         WHERE client_id = $1 AND user_id = $2
         ORDER BY issue_date DESC`,
        [req.params.id, req.userId]
      );

      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
