import { Router, type Router as RouterType } from "express";
import { eq, and, or, ilike, sql, count } from "drizzle-orm";
import { body, param, validationResult } from "express-validator";
import { db, clients, invoices } from "../db/index.js";
import { NotFoundError } from "../middleware/errorHandler.js";
import type { Request, Response, NextFunction } from "express";

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

// Client validation rules
const clientValidation = [
  body("name").trim().notEmpty().withMessage("Client name is required"),
  body("email")
    .optional({ nullable: true })
    .isEmail()
    .withMessage("Invalid email format"),
  body("phone").optional({ nullable: true }).trim(),
  body("address").optional({ nullable: true }).trim(),
  body("company_name").optional({ nullable: true }).trim(),
  body("tax_number").optional({ nullable: true }).trim(),
  body("notes").optional({ nullable: true }).trim(),
];

// GET /api/clients - Get all clients for the user
router.get(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { search, limit = "50", offset = "0" } = req.query;
      const userId = req.userId!;
      const limitNum = parseInt(limit as string, 10);
      const offsetNum = parseInt(offset as string, 10);

      // Build where conditions
      const whereConditions = [eq(clients.userId, userId)];

      if (search) {
        const searchPattern = `%${search}%`;
        whereConditions.push(
          or(
            ilike(clients.name, searchPattern),
            ilike(clients.email, searchPattern),
            ilike(clients.companyName, searchPattern),
          )!,
        );
      }

      // Get clients with invoice statistics
      const result = await db
        .select({
          id: clients.id,
          userId: clients.userId,
          name: clients.name,
          email: clients.email,
          phone: clients.phone,
          address: clients.address,
          companyName: clients.companyName,
          taxNumber: clients.taxNumber,
          notes: clients.notes,
          createdAt: clients.createdAt,
          updatedAt: clients.updatedAt,
          invoiceCount: sql<number>`count(${invoices.id})::int`,
          totalBilled: sql<number>`coalesce(sum(case when ${invoices.status} != 'cancelled' then ${invoices.total}::numeric else 0 end), 0)`,
          totalOutstanding: sql<number>`coalesce(sum(case when ${invoices.status} != 'cancelled' then ${invoices.balanceDue}::numeric else 0 end), 0)`,
        })
        .from(clients)
        .leftJoin(invoices, eq(clients.id, invoices.clientId))
        .where(and(...whereConditions))
        .groupBy(clients.id)
        .orderBy(clients.name)
        .limit(limitNum)
        .offset(offsetNum);

      // Get total count for pagination
      const countResult = await db
        .select({ count: count() })
        .from(clients)
        .where(and(...whereConditions));

      const total = countResult[0]?.count ?? 0;

      res.json({
        clients: result,
        pagination: {
          total,
          limit: limitNum,
          offset: offsetNum,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/clients/:id - Get a single client
router.get(
  "/:id",
  param("id").isUUID().withMessage("Invalid client ID"),
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      const clientId = String(id);
      const result = await db
        .select({
          id: clients.id,
          userId: clients.userId,
          name: clients.name,
          email: clients.email,
          phone: clients.phone,
          address: clients.address,
          companyName: clients.companyName,
          taxNumber: clients.taxNumber,
          notes: clients.notes,
          createdAt: clients.createdAt,
          updatedAt: clients.updatedAt,
          invoiceCount: sql<number>`count(${invoices.id})::int`,
          totalBilled: sql<number>`coalesce(sum(case when ${invoices.status} != 'cancelled' then ${invoices.total}::numeric else 0 end), 0)`,
          totalOutstanding: sql<number>`coalesce(sum(case when ${invoices.status} != 'cancelled' then ${invoices.balanceDue}::numeric else 0 end), 0)`,
        })
        .from(clients)
        .leftJoin(invoices, eq(clients.id, invoices.clientId))
        .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
        .groupBy(clients.id)
        .limit(1);

      if (result.length === 0) {
        throw new NotFoundError("Client not found");
      }

      res.json(result[0]);
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/clients - Create a new client
router.post(
  "/",
  clientValidation,
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, email, phone, address, company_name, tax_number, notes } =
        req.body;
      const userId = req.userId!;

      const result = await db
        .insert(clients)
        .values({
          userId,
          name,
          email: email || null,
          phone: phone || null,
          address: address || null,
          companyName: company_name || null,
          taxNumber: tax_number || null,
          notes: notes || null,
        })
        .returning();

      res.status(201).json(result[0]);
    } catch (error) {
      next(error);
    }
  },
);

// PUT /api/clients/:id - Update a client
router.put(
  "/:id",
  param("id").isUUID().withMessage("Invalid client ID"),
  clientValidation,
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, email, phone, address, company_name, tax_number, notes } =
        req.body;
      const userId = req.userId!;
      const clientId = String(id);

      // First check if client belongs to user
      const existingClient = await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
        .limit(1);

      if (existingClient.length === 0) {
        throw new NotFoundError("Client not found");
      }

      const result = await db
        .update(clients)
        .set({
          name,
          email: email || null,
          phone: phone || null,
          address: address || null,
          companyName: company_name || null,
          taxNumber: tax_number || null,
          notes: notes || null,
          updatedAt: new Date(),
        })
        .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
        .returning();

      res.json(result[0]);
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/clients/:id - Delete a client
router.delete(
  "/:id",
  param("id").isUUID().withMessage("Invalid client ID"),
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const clientId = String(id);

      // Check if client has invoices
      const invoiceCheck = await db
        .select({ count: count() })
        .from(invoices)
        .where(eq(invoices.clientId, clientId));

      const invoiceCount = invoiceCheck[0]?.count ?? 0;

      if (invoiceCount > 0) {
        res.status(400).json({
          error:
            "Cannot delete client with existing invoices. Delete or reassign invoices first.",
        });
        return;
      }

      const result = await db
        .delete(clients)
        .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
        .returning({ id: clients.id });

      if (result.length === 0) {
        throw new NotFoundError("Client not found");
      }

      res.json({ message: "Client deleted successfully" });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/clients/:id/invoices - Get all invoices for a client
router.get(
  "/:id/invoices",
  param("id").isUUID().withMessage("Invalid client ID"),
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const clientId = String(id);

      // First verify client belongs to user
      const clientCheck = await db
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, clientId), eq(clients.userId, userId)))
        .limit(1);

      if (clientCheck.length === 0) {
        throw new NotFoundError("Client not found");
      }

      const result = await db
        .select()
        .from(invoices)
        .where(
          and(eq(invoices.clientId, clientId), eq(invoices.userId, userId)),
        )
        .orderBy(sql`${invoices.issueDate} DESC`);

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
