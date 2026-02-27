import express from 'express';
import { body, param, query as queryValidator, validationResult } from 'express-validator';
import { query, withTransaction } from '../db/index.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const router = express.Router();

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get all invoices for the authenticated user
router.get('/', async (req, res, next) => {
  try {
    const { status, client_id, from_date, to_date, search, sort_by = 'issue_date', sort_order = 'desc', page = 1, limit = 20 } = req.query;
    const userId = req.userId;

    let queryText = `
      SELECT
        i.*,
        c.name as client_name,
        c.email as client_email,
        c.company_name as client_company
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    // Filter by status
    if (status) {
      queryText += ` AND i.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Filter by client
    if (client_id) {
      queryText += ` AND i.client_id = $${paramIndex}`;
      params.push(client_id);
      paramIndex++;
    }

    // Filter by date range
    if (from_date) {
      queryText += ` AND i.issue_date >= $${paramIndex}`;
      params.push(from_date);
      paramIndex++;
    }

    if (to_date) {
      queryText += ` AND i.issue_date <= $${paramIndex}`;
      params.push(to_date);
      paramIndex++;
    }

    // Search by invoice number or client name
    if (search) {
      queryText += ` AND (i.invoice_number ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex} OR c.company_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Sorting
    const allowedSortFields = ['issue_date', 'due_date', 'total', 'invoice_number', 'status', 'created_at'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'issue_date';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    queryText += ` ORDER BY i.${sortField} ${sortDirection}`;

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await query(queryText, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      WHERE i.user_id = $1
    `;
    const countParams = [userId];
    let countParamIndex = 2;

    if (status) {
      countQuery += ` AND i.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }
    if (client_id) {
      countQuery += ` AND i.client_id = $${countParamIndex}`;
      countParams.push(client_id);
      countParamIndex++;
    }
    if (from_date) {
      countQuery += ` AND i.issue_date >= $${countParamIndex}`;
      countParams.push(from_date);
      countParamIndex++;
    }
    if (to_date) {
      countQuery += ` AND i.issue_date <= $${countParamIndex}`;
      countParams.push(to_date);
      countParamIndex++;
    }
    if (search) {
      countQuery += ` AND (i.invoice_number ILIKE $${countParamIndex} OR c.name ILIKE $${countParamIndex} OR c.company_name ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      invoices: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get a single invoice by ID
router.get('/:id',
  param('id').isUUID(),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.userId;

      // Get invoice with client info
      const invoiceResult = await query(
        `SELECT
          i.*,
          c.name as client_name,
          c.email as client_email,
          c.phone as client_phone,
          c.address as client_address,
          c.company_name as client_company,
          c.tax_number as client_tax_number
        FROM invoices i
        JOIN clients c ON i.client_id = c.id
        WHERE i.id = $1 AND i.user_id = $2`,
        [id, userId]
      );

      if (invoiceResult.rows.length === 0) {
        throw new NotFoundError('Invoice not found');
      }

      // Get invoice items
      const itemsResult = await query(
        `SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order ASC`,
        [id]
      );

      // Get payments
      const paymentsResult = await query(
        `SELECT * FROM payments WHERE invoice_id = $1 ORDER BY payment_date DESC`,
        [id]
      );

      const invoice = invoiceResult.rows[0];
      invoice.items = itemsResult.rows;
      invoice.payments = paymentsResult.rows;

      res.json(invoice);
    } catch (error) {
      next(error);
    }
  }
);

// Create a new invoice
router.post('/',
  [
    body('client_id').isUUID().withMessage('Valid client ID is required'),
    body('issue_date').optional().isISO8601(),
    body('due_date').optional().isISO8601(),
    body('due_terms').optional().isString(),
    body('currency').optional().isLength({ min: 3, max: 3 }),
    body('tax_rate').optional().isFloat({ min: 0, max: 100 }),
    body('discount_type').optional().isIn(['percentage', 'fixed', null]),
    body('discount_value').optional().isFloat({ min: 0 }),
    body('notes').optional().isString(),
    body('terms').optional().isString(),
    body('items').optional().isArray(),
    body('items.*.description').optional().isString().notEmpty(),
    body('items.*.quantity').optional().isFloat({ min: 0 }),
    body('items.*.rate').optional().isFloat({ min: 0 })
  ],
  validate,
  async (req, res, next) => {
    try {
      const userId = req.userId;
      const {
        client_id,
        issue_date = new Date().toISOString().split('T')[0],
        due_date,
        due_terms = 'on_receipt',
        currency = req.user.default_currency || 'GBP',
        tax_rate = 0,
        discount_type,
        discount_value = 0,
        notes,
        terms,
        footer,
        items = []
      } = req.body;

      const invoice = await withTransaction(async (client) => {
        // Generate invoice number
        const invoiceNumberResult = await client.query(
          'SELECT generate_invoice_number($1) as invoice_number',
          [userId]
        );
        const invoiceNumber = invoiceNumberResult.rows[0].invoice_number;

        // Create invoice
        const invoiceResult = await client.query(
          `INSERT INTO invoices (
            user_id, client_id, invoice_number, issue_date, due_date, due_terms,
            currency, tax_rate, discount_type, discount_value, notes, terms, footer
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *`,
          [userId, client_id, invoiceNumber, issue_date, due_date, due_terms,
            currency, tax_rate, discount_type, discount_value, notes, terms, footer]
        );

        const invoice = invoiceResult.rows[0];

        // Create invoice items
        if (items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const amount = (item.quantity || 1) * (item.rate || 0);
            await client.query(
              `INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount, sort_order)
              VALUES ($1, $2, $3, $4, $5, $6)`,
              [invoice.id, item.description, item.quantity || 1, item.rate || 0, amount, i]
            );
          }

          // Recalculate totals
          await client.query('SELECT calculate_invoice_totals($1)', [invoice.id]);
        }

        // Fetch the updated invoice
        const updatedResult = await client.query(
          'SELECT * FROM invoices WHERE id = $1',
          [invoice.id]
        );

        return updatedResult.rows[0];
      });

      // Fetch items for response
      const itemsResult = await query(
        'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order',
        [invoice.id]
      );
      invoice.items = itemsResult.rows;

      res.status(201).json(invoice);
    } catch (error) {
      next(error);
    }
  }
);

// Update an invoice
router.put('/:id',
  [
    param('id').isUUID(),
    body('client_id').optional().isUUID(),
    body('issue_date').optional().isISO8601(),
    body('due_date').optional().isISO8601(),
    body('due_terms').optional().isString(),
    body('currency').optional().isLength({ min: 3, max: 3 }),
    body('tax_rate').optional().isFloat({ min: 0, max: 100 }),
    body('discount_type').optional().isIn(['percentage', 'fixed', null]),
    body('discount_value').optional().isFloat({ min: 0 }),
    body('items').optional().isArray()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.userId;

      // Check if invoice exists and belongs to user
      const existingResult = await query(
        'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (existingResult.rows.length === 0) {
        throw new NotFoundError('Invoice not found');
      }

      const existing = existingResult.rows[0];

      // Don't allow editing paid or cancelled invoices
      if (['paid', 'cancelled'].includes(existing.status)) {
        throw new ValidationError(`Cannot edit ${existing.status} invoices`);
      }

      const {
        client_id = existing.client_id,
        issue_date = existing.issue_date,
        due_date = existing.due_date,
        due_terms = existing.due_terms,
        currency = existing.currency,
        tax_rate = existing.tax_rate,
        discount_type = existing.discount_type,
        discount_value = existing.discount_value,
        notes = existing.notes,
        terms = existing.terms,
        footer = existing.footer,
        items
      } = req.body;

      const invoice = await withTransaction(async (client) => {
        // Update invoice
        await client.query(
          `UPDATE invoices SET
            client_id = $1, issue_date = $2, due_date = $3, due_terms = $4,
            currency = $5, tax_rate = $6, discount_type = $7, discount_value = $8,
            notes = $9, terms = $10, footer = $11
          WHERE id = $12`,
          [client_id, issue_date, due_date, due_terms, currency, tax_rate,
            discount_type, discount_value, notes, terms, footer, id]
        );

        // Update items if provided
        if (items !== undefined) {
          // Delete existing items
          await client.query('DELETE FROM invoice_items WHERE invoice_id = $1', [id]);

          // Insert new items
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const amount = (item.quantity || 1) * (item.rate || 0);
            await client.query(
              `INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount, sort_order)
              VALUES ($1, $2, $3, $4, $5, $6)`,
              [id, item.description, item.quantity || 1, item.rate || 0, amount, i]
            );
          }

          // Recalculate totals
          await client.query('SELECT calculate_invoice_totals($1)', [id]);
        }

        // Fetch updated invoice
        const result = await client.query('SELECT * FROM invoices WHERE id = $1', [id]);
        return result.rows[0];
      });

      // Fetch items for response
      const itemsResult = await query(
        'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order',
        [id]
      );
      invoice.items = itemsResult.rows;

      res.json(invoice);
    } catch (error) {
      next(error);
    }
  }
);

// Update invoice status
router.patch('/:id/status',
  [
    param('id').isUUID(),
    body('status').isIn(['draft', 'sent', 'viewed', 'paid', 'overdue', 'cancelled'])
  ],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.userId;

      const existing = await query(
        'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (existing.rows.length === 0) {
        throw new NotFoundError('Invoice not found');
      }

      const updateFields = { status };

      // Add timestamp fields based on status change
      if (status === 'sent' && !existing.rows[0].sent_at) {
        updateFields.sent_at = new Date();
      }
      if (status === 'viewed' && !existing.rows[0].viewed_at) {
        updateFields.viewed_at = new Date();
      }
      if (status === 'paid' && !existing.rows[0].paid_at) {
        updateFields.paid_at = new Date();
        // Set amount_paid to total if marking as paid
        updateFields.amount_paid = existing.rows[0].total;
        updateFields.balance_due = 0;
      }

      const setClauses = Object.keys(updateFields).map((key, i) => `${key} = $${i + 1}`).join(', ');
      const values = [...Object.values(updateFields), id, userId];

      const result = await query(
        `UPDATE invoices SET ${setClauses} WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`,
        values
      );

      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  }
);

// Add a payment to an invoice
router.post('/:id/payments',
  [
    param('id').isUUID(),
    body('amount').isFloat({ min: 0.01 }).withMessage('Payment amount must be positive'),
    body('payment_date').optional().isISO8601(),
    body('payment_method').optional().isString(),
    body('reference').optional().isString(),
    body('notes').optional().isString()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const {
        amount,
        payment_date = new Date().toISOString().split('T')[0],
        payment_method,
        reference,
        notes
      } = req.body;

      // Check if invoice exists and belongs to user
      const invoiceResult = await query(
        'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (invoiceResult.rows.length === 0) {
        throw new NotFoundError('Invoice not found');
      }

      const invoice = invoiceResult.rows[0];

      if (invoice.status === 'cancelled') {
        throw new ValidationError('Cannot add payment to cancelled invoice');
      }

      const payment = await withTransaction(async (client) => {
        // Create payment
        const paymentResult = await client.query(
          `INSERT INTO payments (invoice_id, amount, payment_date, payment_method, reference, notes)
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [id, amount, payment_date, payment_method, reference, notes]
        );

        // Update invoice amount_paid and balance_due
        const newAmountPaid = parseFloat(invoice.amount_paid) + parseFloat(amount);
        const newBalanceDue = parseFloat(invoice.total) - newAmountPaid;

        // Determine new status
        let newStatus = invoice.status;
        if (newBalanceDue <= 0) {
          newStatus = 'paid';
        }

        await client.query(
          `UPDATE invoices SET
            amount_paid = $1,
            balance_due = $2,
            status = $3,
            paid_at = CASE WHEN $3 = 'paid' THEN CURRENT_TIMESTAMP ELSE paid_at END
          WHERE id = $4`,
          [newAmountPaid, Math.max(0, newBalanceDue), newStatus, id]
        );

        return paymentResult.rows[0];
      });

      res.status(201).json(payment);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a payment
router.delete('/:invoiceId/payments/:paymentId',
  [
    param('invoiceId').isUUID(),
    param('paymentId').isUUID()
  ],
  validate,
  async (req, res, next) => {
    try {
      const { invoiceId, paymentId } = req.params;
      const userId = req.userId;

      // Verify invoice belongs to user
      const invoiceResult = await query(
        'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
        [invoiceId, userId]
      );

      if (invoiceResult.rows.length === 0) {
        throw new NotFoundError('Invoice not found');
      }

      // Get payment
      const paymentResult = await query(
        'SELECT * FROM payments WHERE id = $1 AND invoice_id = $2',
        [paymentId, invoiceId]
      );

      if (paymentResult.rows.length === 0) {
        throw new NotFoundError('Payment not found');
      }

      const payment = paymentResult.rows[0];
      const invoice = invoiceResult.rows[0];

      await withTransaction(async (client) => {
        // Delete payment
        await client.query('DELETE FROM payments WHERE id = $1', [paymentId]);

        // Update invoice totals
        const newAmountPaid = parseFloat(invoice.amount_paid) - parseFloat(payment.amount);
        const newBalanceDue = parseFloat(invoice.total) - newAmountPaid;

        // Update status if it was paid
        let newStatus = invoice.status;
        if (invoice.status === 'paid' && newBalanceDue > 0) {
          newStatus = invoice.sent_at ? 'sent' : 'draft';
        }

        await client.query(
          `UPDATE invoices SET
            amount_paid = $1,
            balance_due = $2,
            status = $3,
            paid_at = CASE WHEN $3 != 'paid' THEN NULL ELSE paid_at END
          WHERE id = $4`,
          [Math.max(0, newAmountPaid), newBalanceDue, newStatus, invoiceId]
        );
      });

      res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Delete an invoice
router.delete('/:id',
  param('id').isUUID(),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.userId;

      const result = await query(
        'DELETE FROM invoices WHERE id = $1 AND user_id = $2 RETURNING id',
        [id, userId]
      );

      if (result.rowCount === 0) {
        throw new NotFoundError('Invoice not found');
      }

      res.json({ message: 'Invoice deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Duplicate an invoice
router.post('/:id/duplicate',
  param('id').isUUID(),
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.userId;

      // Get original invoice
      const originalResult = await query(
        'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
        [id, userId]
      );

      if (originalResult.rows.length === 0) {
        throw new NotFoundError('Invoice not found');
      }

      const original = originalResult.rows[0];

      // Get original items
      const itemsResult = await query(
        'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order',
        [id]
      );

      const newInvoice = await withTransaction(async (client) => {
        // Generate new invoice number
        const invoiceNumberResult = await client.query(
          'SELECT generate_invoice_number($1) as invoice_number',
          [userId]
        );
        const invoiceNumber = invoiceNumberResult.rows[0].invoice_number;

        // Create new invoice
        const newResult = await client.query(
          `INSERT INTO invoices (
            user_id, client_id, invoice_number, issue_date, due_date, due_terms,
            currency, tax_rate, discount_type, discount_value, notes, terms, footer,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'draft')
          RETURNING *`,
          [userId, original.client_id, invoiceNumber, new Date().toISOString().split('T')[0],
            original.due_date, original.due_terms, original.currency, original.tax_rate,
            original.discount_type, original.discount_value, original.notes, original.terms,
            original.footer]
        );

        const newInvoice = newResult.rows[0];

        // Copy items
        for (const item of itemsResult.rows) {
          await client.query(
            `INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [newInvoice.id, item.description, item.quantity, item.rate, item.amount, item.sort_order]
          );
        }

        // Recalculate totals
        await client.query('SELECT calculate_invoice_totals($1)', [newInvoice.id]);

        // Fetch updated invoice
        const result = await client.query('SELECT * FROM invoices WHERE id = $1', [newInvoice.id]);
        return result.rows[0];
      });

      // Fetch items for response
      const newItemsResult = await query(
        'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order',
        [newInvoice.id]
      );
      newInvoice.items = newItemsResult.rows;

      res.status(201).json(newInvoice);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
