import { Router, type Router as RouterType } from "express";
import {
  eq,
  and,
  or,
  ilike,
  sql,
  gte,
  lte,
  desc,
  asc,
  count,
} from "drizzle-orm";
import { body, param, validationResult } from "express-validator";
import {
  db,
  invoices,
  invoiceItems,
  clients,
  payments,
  invoiceSequences,
  withTransaction,
} from "../db/index.js";
import { NotFoundError, ValidationError } from "../middleware/errorHandler.js";
import type { Request, Response, NextFunction } from "express";
import type { InvoiceStatus } from "../db/schema.js";

const router: RouterType = Router();

// Validation middleware
const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

// Helper function to generate invoice number
async function generateInvoiceNumber(userId: string): Promise<string> {
  // Get or create sequence for user
  const existing = await db
    .select()
    .from(invoiceSequences)
    .where(eq(invoiceSequences.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(invoiceSequences).values({ userId });
  }

  // Get current sequence values and increment
  const result = await db
    .update(invoiceSequences)
    .set({
      nextNumber: sql`${invoiceSequences.nextNumber} + 1`,
    })
    .where(eq(invoiceSequences.userId, userId))
    .returning({
      prefix: invoiceSequences.prefix,
      nextNumber: sql<number>`${invoiceSequences.nextNumber} - 1`,
      padding: invoiceSequences.padding,
    });

  const seq = result[0]!;
  const invoiceNumber =
    seq.prefix + String(seq.nextNumber).padStart(seq.padding ?? 4, "0");

  return invoiceNumber;
}

// Helper function to calculate invoice totals
async function calculateInvoiceTotals(invoiceId: string): Promise<void> {
  // Calculate subtotal from items
  const itemsResult = await db
    .select({
      subtotal: sql<number>`coalesce(sum(${invoiceItems.amount}::numeric), 0)`,
    })
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId));

  const subtotal = Number(itemsResult[0]?.subtotal ?? 0);

  // Get invoice settings
  const invoiceResult = await db
    .select({
      taxRate: invoices.taxRate,
      discountType: invoices.discountType,
      discountValue: invoices.discountValue,
      amountPaid: invoices.amountPaid,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  const invoice = invoiceResult[0];
  if (!invoice) return;

  const taxRate = Number(invoice.taxRate ?? 0);
  const discountValue = Number(invoice.discountValue ?? 0);
  const amountPaid = Number(invoice.amountPaid ?? 0);

  // Calculate discount
  let discountAmount = 0;
  if (invoice.discountType === "percentage") {
    discountAmount = subtotal * (discountValue / 100);
  } else if (invoice.discountType === "fixed") {
    discountAmount = discountValue;
  }

  // Calculate tax
  const taxAmount = (subtotal - discountAmount) * (taxRate / 100);

  // Calculate total
  const total = subtotal - discountAmount + taxAmount;
  const balanceDue = total - amountPaid;

  // Update invoice
  await db
    .update(invoices)
    .set({
      subtotal: String(subtotal),
      taxAmount: String(taxAmount),
      discountAmount: String(discountAmount),
      total: String(total),
      balanceDue: String(balanceDue),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));
}

// Get all invoices for the authenticated user
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        status,
        client_id,
        from_date,
        to_date,
        search,
        sort_by = "issue_date",
        sort_order = "desc",
        page = "1",
        limit = "20",
      } = req.query;
      const userId = req.userId!;
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      // Build where conditions
      const whereConditions = [eq(invoices.userId, userId)];

      if (status) {
        whereConditions.push(eq(invoices.status, status as InvoiceStatus));
      }

      if (client_id) {
        whereConditions.push(eq(invoices.clientId, client_id as string));
      }

      if (from_date) {
        whereConditions.push(gte(invoices.issueDate, from_date as string));
      }

      if (to_date) {
        whereConditions.push(lte(invoices.issueDate, to_date as string));
      }

      if (search) {
        const searchPattern = `%${search}%`;
        whereConditions.push(
          or(
            ilike(invoices.invoiceNumber, searchPattern),
            ilike(clients.name, searchPattern),
            ilike(clients.companyName, searchPattern),
          )!,
        );
      }

      // Determine sort order
      const allowedSortFields = [
        "issue_date",
        "due_date",
        "total",
        "invoice_number",
        "status",
        "created_at",
      ];
      const sortField = allowedSortFields.includes(sort_by as string)
        ? (sort_by as string)
        : "issue_date";
      const sortDirection =
        (sort_order as string).toLowerCase() === "asc" ? asc : desc;

      // Build sort expression based on field
      const getSortExpression = (field: string) => {
        switch (field) {
          case "due_date":
            return sortDirection(invoices.dueDate);
          case "total":
            return sortDirection(invoices.total);
          case "invoice_number":
            return sortDirection(invoices.invoiceNumber);
          case "status":
            return sortDirection(invoices.status);
          case "created_at":
            return sortDirection(invoices.createdAt);
          case "issue_date":
          default:
            return sortDirection(invoices.issueDate);
        }
      };

      // Execute query
      const result = await db
        .select({
          id: invoices.id,
          userId: invoices.userId,
          clientId: invoices.clientId,
          invoiceNumber: invoices.invoiceNumber,
          status: invoices.status,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          dueTerms: invoices.dueTerms,
          currency: invoices.currency,
          subtotal: invoices.subtotal,
          taxRate: invoices.taxRate,
          taxAmount: invoices.taxAmount,
          discountType: invoices.discountType,
          discountValue: invoices.discountValue,
          discountAmount: invoices.discountAmount,
          total: invoices.total,
          amountPaid: invoices.amountPaid,
          balanceDue: invoices.balanceDue,
          notes: invoices.notes,
          terms: invoices.terms,
          footer: invoices.footer,
          sentAt: invoices.sentAt,
          viewedAt: invoices.viewedAt,
          paidAt: invoices.paidAt,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
          client_name: clients.name,
          client_email: clients.email,
          client_company: clients.companyName,
        })
        .from(invoices)
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(and(...whereConditions))
        .orderBy(getSortExpression(sortField))
        .limit(limitNum)
        .offset(offset);

      // Get total count for pagination
      const countResult = await db
        .select({ count: count() })
        .from(invoices)
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(and(...whereConditions));

      const total = Number(countResult[0]?.count ?? 0);

      res.json({
        invoices: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get a single invoice by ID
router.get(
  "/:id",
  param("id").isUUID(),
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const invoiceId = String(id);

      // Get invoice with client info
      const invoiceResult = await db
        .select({
          id: invoices.id,
          userId: invoices.userId,
          clientId: invoices.clientId,
          invoiceNumber: invoices.invoiceNumber,
          status: invoices.status,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          dueTerms: invoices.dueTerms,
          currency: invoices.currency,
          subtotal: invoices.subtotal,
          taxRate: invoices.taxRate,
          taxAmount: invoices.taxAmount,
          discountType: invoices.discountType,
          discountValue: invoices.discountValue,
          discountAmount: invoices.discountAmount,
          total: invoices.total,
          amountPaid: invoices.amountPaid,
          balanceDue: invoices.balanceDue,
          notes: invoices.notes,
          terms: invoices.terms,
          footer: invoices.footer,
          sentAt: invoices.sentAt,
          viewedAt: invoices.viewedAt,
          paidAt: invoices.paidAt,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
          client_name: clients.name,
          client_email: clients.email,
          client_phone: clients.phone,
          client_address: clients.address,
          client_company: clients.companyName,
          client_tax_number: clients.taxNumber,
        })
        .from(invoices)
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
        .limit(1);

      if (invoiceResult.length === 0) {
        throw new NotFoundError("Invoice not found");
      }

      // Get invoice items
      const itemsResult = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoiceId))
        .orderBy(asc(invoiceItems.sortOrder));

      // Get payments
      const paymentsResult = await db
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, invoiceId))
        .orderBy(desc(payments.paymentDate));

      const invoice = {
        ...invoiceResult[0],
        items: itemsResult,
        payments: paymentsResult,
      };

      res.json(invoice);
    } catch (error) {
      next(error);
    }
  },
);

// Create a new invoice
router.post(
  "/",
  [
    body("client_id").isUUID().withMessage("Valid client ID is required"),
    body("issue_date").optional().isISO8601(),
    body("due_date").optional().isISO8601(),
    body("due_terms").optional().isString(),
    body("currency").optional().isLength({ min: 3, max: 3 }),
    body("tax_rate").optional().isFloat({ min: 0, max: 100 }),
    body("discount_type").optional().isIn(["percentage", "fixed", null]),
    body("discount_value").optional().isFloat({ min: 0 }),
    body("notes").optional().isString(),
    body("terms").optional().isString(),
    body("items").optional().isArray(),
    body("items.*.description").optional().isString().notEmpty(),
    body("items.*.quantity").optional().isFloat({ min: 0 }),
    body("items.*.rate").optional().isFloat({ min: 0 }),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const {
        client_id,
        issue_date = new Date().toISOString().split("T")[0],
        due_date,
        due_terms = "on_receipt",
        currency = req.user?.defaultCurrency || "GBP",
        tax_rate = 0,
        discount_type,
        discount_value = 0,
        notes,
        terms,
        footer,
        items = [],
      } = req.body;

      const invoice = await withTransaction(async (tx) => {
        // Generate invoice number
        const invoiceNumber = await generateInvoiceNumber(userId);

        // Create invoice
        const invoiceResult = await tx
          .insert(invoices)
          .values({
            userId,
            clientId: client_id,
            invoiceNumber,
            issueDate: issue_date,
            dueDate: due_date,
            dueTerms: due_terms,
            currency,
            taxRate: String(tax_rate),
            discountType: discount_type,
            discountValue: String(discount_value),
            notes,
            terms,
            footer,
          })
          .returning();

        const invoice = invoiceResult[0]!;

        // Create invoice items
        if (items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const quantity = item.quantity || 1;
            const rate = item.rate || 0;
            const amount = quantity * rate;

            await tx.insert(invoiceItems).values({
              invoiceId: invoice.id,
              description: item.description,
              quantity: String(quantity),
              rate: String(rate),
              amount: String(amount),
              sortOrder: i,
            });
          }
        }

        return invoice;
      });

      // Recalculate totals (outside transaction for simplicity)
      await calculateInvoiceTotals(invoice.id);

      // Fetch the updated invoice with items
      const updatedInvoice = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoice.id))
        .limit(1);

      const itemsResult = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoice.id))
        .orderBy(asc(invoiceItems.sortOrder));

      res.status(201).json({
        ...updatedInvoice[0],
        items: itemsResult,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Update an invoice
router.put(
  "/:id",
  [
    param("id").isUUID(),
    body("client_id").optional().isUUID(),
    body("issue_date").optional().isISO8601(),
    body("due_date").optional().isISO8601(),
    body("due_terms").optional().isString(),
    body("currency").optional().isLength({ min: 3, max: 3 }),
    body("tax_rate").optional().isFloat({ min: 0, max: 100 }),
    body("discount_type").optional().isIn(["percentage", "fixed", null]),
    body("discount_value").optional().isFloat({ min: 0 }),
    body("items").optional().isArray(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const invoiceId = String(id);

      // Check if invoice exists and belongs to user
      const existingResult = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
        .limit(1);

      if (existingResult.length === 0) {
        throw new NotFoundError("Invoice not found");
      }

      const existing = existingResult[0]!;

      // Don't allow editing paid or cancelled invoices
      if (["paid", "cancelled"].includes(existing.status ?? "")) {
        throw new ValidationError(`Cannot edit ${existing.status} invoices`);
      }

      const {
        client_id = existing.clientId,
        issue_date = existing.issueDate,
        due_date = existing.dueDate,
        due_terms = existing.dueTerms,
        currency = existing.currency,
        tax_rate = existing.taxRate,
        discount_type = existing.discountType,
        discount_value = existing.discountValue,
        notes = existing.notes,
        terms = existing.terms,
        footer = existing.footer,
        items,
      } = req.body;

      await withTransaction(async (tx) => {
        // Update invoice
        await tx
          .update(invoices)
          .set({
            clientId: client_id,
            issueDate: issue_date,
            dueDate: due_date,
            dueTerms: due_terms,
            currency,
            taxRate: String(tax_rate),
            discountType: discount_type,
            discountValue: String(discount_value),
            notes,
            terms,
            footer,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoiceId));

        // Update items if provided
        if (items !== undefined) {
          // Delete existing items
          await tx
            .delete(invoiceItems)
            .where(eq(invoiceItems.invoiceId, invoiceId));

          // Insert new items
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const quantity = item.quantity || 1;
            const rate = item.rate || 0;
            const amount = quantity * rate;

            await tx.insert(invoiceItems).values({
              invoiceId: invoiceId,
              description: item.description,
              quantity: String(quantity),
              rate: String(rate),
              amount: String(amount),
              sortOrder: i,
            });
          }
        }
      });

      // Recalculate totals
      await calculateInvoiceTotals(invoiceId);

      // Fetch updated invoice with items
      const updatedInvoice = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1);

      const itemsResult = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoiceId))
        .orderBy(asc(invoiceItems.sortOrder));

      res.json({
        ...updatedInvoice[0],
        items: itemsResult,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Update invoice status
router.patch(
  "/:id/status",
  [
    param("id").isUUID(),
    body("status").isIn([
      "draft",
      "sent",
      "viewed",
      "paid",
      "overdue",
      "cancelled",
    ]),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.userId!;
      const invoiceId = String(id);

      const existingResult = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
        .limit(1);

      if (existingResult.length === 0) {
        throw new NotFoundError("Invoice not found");
      }

      const existing = existingResult[0]!;

      // Build update fields
      const updateFields: Partial<typeof invoices.$inferInsert> = {
        status,
        updatedAt: new Date(),
      };

      // Add timestamp fields based on status change
      if (status === "sent" && !existing.sentAt) {
        updateFields.sentAt = new Date();
      }
      if (status === "viewed" && !existing.viewedAt) {
        updateFields.viewedAt = new Date();
      }
      if (status === "paid" && !existing.paidAt) {
        updateFields.paidAt = new Date();
        // Set amount_paid to total if marking as paid
        updateFields.amountPaid = existing.total;
        updateFields.balanceDue = "0";
      }

      const result = await db
        .update(invoices)
        .set(updateFields)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
        .returning();

      res.json(result[0]);
    } catch (error) {
      next(error);
    }
  },
);

// Add a payment to an invoice
router.post(
  "/:id/payments",
  [
    param("id").isUUID(),
    body("amount")
      .isFloat({ min: 0.01 })
      .withMessage("Payment amount must be positive"),
    body("payment_date").optional().isISO8601(),
    body("payment_method").optional().isString(),
    body("reference").optional().isString(),
    body("notes").optional().isString(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const invoiceId = String(id);
      const {
        amount,
        payment_date = new Date().toISOString().split("T")[0],
        payment_method,
        reference,
        notes,
      } = req.body;

      // Check if invoice exists and belongs to user
      const invoiceResult = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
        .limit(1);

      if (invoiceResult.length === 0) {
        throw new NotFoundError("Invoice not found");
      }

      const invoice = invoiceResult[0]!;

      if (invoice.status === "cancelled") {
        throw new ValidationError("Cannot add payment to cancelled invoice");
      }

      const payment = await withTransaction(async (tx) => {
        // Create payment
        const paymentResult = await tx
          .insert(payments)
          .values({
            invoiceId: invoiceId,
            amount: String(amount),
            paymentDate: payment_date,
            paymentMethod: payment_method,
            reference,
            notes,
          })
          .returning();

        // Update invoice amount_paid and balance_due
        const newAmountPaid = Number(invoice.amountPaid ?? 0) + amount;
        const newBalanceDue = Number(invoice.total ?? 0) - newAmountPaid;

        // Determine new status
        let newStatus = invoice.status;
        if (newBalanceDue <= 0) {
          newStatus = "paid";
        }

        await tx
          .update(invoices)
          .set({
            amountPaid: String(newAmountPaid),
            balanceDue: String(Math.max(0, newBalanceDue)),
            status: newStatus,
            paidAt: newStatus === "paid" ? new Date() : invoice.paidAt,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoiceId));

        return paymentResult[0]!;
      });

      res.status(201).json(payment);
    } catch (error) {
      next(error);
    }
  },
);

// Delete a payment
router.delete(
  "/:invoiceId/payments/:paymentId",
  [param("invoiceId").isUUID(), param("paymentId").isUUID()],
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { invoiceId, paymentId } = req.params;
      const userId = req.userId!;
      const invoiceIdStr = String(invoiceId);
      const paymentIdStr = String(paymentId);

      // Verify invoice belongs to user
      const invoiceResult = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, invoiceIdStr), eq(invoices.userId, userId)))
        .limit(1);

      if (invoiceResult.length === 0) {
        throw new NotFoundError("Invoice not found");
      }

      // Get payment
      const paymentResult = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, paymentIdStr),
            eq(payments.invoiceId, invoiceIdStr),
          ),
        )
        .limit(1);

      if (paymentResult.length === 0) {
        throw new NotFoundError("Payment not found");
      }

      const payment = paymentResult[0]!;
      const invoice = invoiceResult[0]!;

      await withTransaction(async (tx) => {
        // Delete payment
        await tx.delete(payments).where(eq(payments.id, paymentIdStr));

        // Update invoice totals
        const newAmountPaid =
          Number(invoice.amountPaid ?? 0) - Number(payment.amount);
        const newBalanceDue = Number(invoice.total ?? 0) - newAmountPaid;

        // Update status if it was paid
        let newStatus = invoice.status;
        if (invoice.status === "paid" && newBalanceDue > 0) {
          newStatus = invoice.sentAt ? "sent" : "draft";
        }

        await tx
          .update(invoices)
          .set({
            amountPaid: String(Math.max(0, newAmountPaid)),
            balanceDue: String(newBalanceDue),
            status: newStatus,
            paidAt: newStatus !== "paid" ? null : invoice.paidAt,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoiceIdStr));
      });

      res.json({ message: "Payment deleted successfully" });
    } catch (error) {
      next(error);
    }
  },
);

// Delete an invoice
router.delete(
  "/:id",
  param("id").isUUID(),
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const invoiceId = String(id);

      const result = await db
        .delete(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
        .returning({ id: invoices.id });

      if (result.length === 0) {
        throw new NotFoundError("Invoice not found");
      }

      res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
      next(error);
    }
  },
);

// Duplicate an invoice
router.post(
  "/:id/duplicate",
  param("id").isUUID(),
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const invoiceId = String(id);

      // Get original invoice
      const originalResult = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
        .limit(1);

      if (originalResult.length === 0) {
        throw new NotFoundError("Invoice not found");
      }

      const original = originalResult[0]!;

      // Get original items
      const itemsResult = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoiceId))
        .orderBy(asc(invoiceItems.sortOrder));

      const newInvoice = await withTransaction(async (tx) => {
        // Generate new invoice number
        const invoiceNumber = await generateInvoiceNumber(userId);

        // Create new invoice
        const newResult = await tx
          .insert(invoices)
          .values({
            userId,
            clientId: original.clientId,
            invoiceNumber,
            issueDate: new Date().toISOString().split("T")[0],
            dueDate: original.dueDate,
            dueTerms: original.dueTerms,
            currency: original.currency,
            taxRate: original.taxRate,
            discountType: original.discountType,
            discountValue: original.discountValue,
            notes: original.notes,
            terms: original.terms,
            footer: original.footer,
            status: "draft",
          })
          .returning();

        const newInvoice = newResult[0]!;

        // Copy items
        for (const item of itemsResult) {
          await tx.insert(invoiceItems).values({
            invoiceId: newInvoice.id,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.amount,
            sortOrder: item.sortOrder,
          });
        }

        return newInvoice;
      });

      // Recalculate totals
      await calculateInvoiceTotals(newInvoice.id);

      // Fetch updated invoice with items
      const updatedInvoice = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, newInvoice.id))
        .limit(1);

      const newItemsResult = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, newInvoice.id))
        .orderBy(asc(invoiceItems.sortOrder));

      res.status(201).json({
        ...updatedInvoice[0],
        items: newItemsResult,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
