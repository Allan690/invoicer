import { Router, type Router as RouterType } from "express";
import { eq, and } from "drizzle-orm";
import { body, param, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import { db, users, invoiceSequences, invoiceTemplates } from "../db/index.js";
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

// Get user profile/settings
router.get(
  "/profile",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;

      const result = await db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          businessName: users.businessName,
          address: users.address,
          phone: users.phone,
          logoUrl: users.logoUrl,
          defaultCurrency: users.defaultCurrency,
          taxNumber: users.taxNumber,
          bankName: users.bankName,
          bankAccountNumber: users.bankAccountNumber,
          bankSortCode: users.bankSortCode,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (result.length === 0) {
        throw new NotFoundError("User not found");
      }

      const user = result[0]!;

      res.json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        businessName: user.businessName,
        address: user.address,
        phone: user.phone,
        logoUrl: user.logoUrl,
        defaultCurrency: user.defaultCurrency,
        taxNumber: user.taxNumber,
        bankName: user.bankName,
        bankAccountNumber: user.bankAccountNumber,
        bankSortCode: user.bankSortCode,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Update user profile
router.put(
  "/profile",
  [
    body("fullName")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Full name cannot be empty"),
    body("businessName").optional().trim(),
    body("address").optional().trim(),
    body("phone").optional().trim(),
    body("defaultCurrency")
      .optional()
      .isLength({ min: 3, max: 3 })
      .withMessage("Currency must be 3 characters"),
    body("taxNumber").optional().trim(),
    body("bankName").optional().trim(),
    body("bankAccountNumber").optional().trim(),
    body("bankSortCode").optional().trim(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const {
        fullName,
        businessName,
        address,
        phone,
        defaultCurrency,
        taxNumber,
        bankName,
        bankAccountNumber,
        bankSortCode,
      } = req.body;

      // Get current user data
      const currentResult = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (currentResult.length === 0) {
        throw new NotFoundError("User not found");
      }

      const current = currentResult[0]!;

      // Update user
      const result = await db
        .update(users)
        .set({
          fullName: fullName ?? current.fullName,
          businessName: businessName ?? current.businessName,
          address: address ?? current.address,
          phone: phone ?? current.phone,
          defaultCurrency: defaultCurrency ?? current.defaultCurrency,
          taxNumber: taxNumber ?? current.taxNumber,
          bankName: bankName ?? current.bankName,
          bankAccountNumber: bankAccountNumber ?? current.bankAccountNumber,
          bankSortCode: bankSortCode ?? current.bankSortCode,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          businessName: users.businessName,
          address: users.address,
          phone: users.phone,
          logoUrl: users.logoUrl,
          defaultCurrency: users.defaultCurrency,
          taxNumber: users.taxNumber,
          bankName: users.bankName,
          bankAccountNumber: users.bankAccountNumber,
          bankSortCode: users.bankSortCode,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      const user = result[0]!;

      res.json({
        message: "Profile updated successfully",
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          businessName: user.businessName,
          address: user.address,
          phone: user.phone,
          logoUrl: user.logoUrl,
          defaultCurrency: user.defaultCurrency,
          taxNumber: user.taxNumber,
          bankName: user.bankName,
          bankAccountNumber: user.bankAccountNumber,
          bankSortCode: user.bankSortCode,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Change password
router.put(
  "/password",
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const { currentPassword, newPassword } = req.body;

      // Get current user with password
      const result = await db
        .select({
          id: users.id,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (result.length === 0) {
        throw new NotFoundError("User not found");
      }

      const user = result[0]!;

      // Verify current password
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.passwordHash,
      );

      if (!isValidPassword) {
        res.status(400).json({
          error: "Invalid current password",
        });
        return;
      }

      // Hash new password
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await db
        .update(users)
        .set({
          passwordHash: newPasswordHash,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      res.json({
        message: "Password changed successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get invoice settings (number format, etc.)
router.get(
  "/invoice",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;

      const result = await db
        .select({
          prefix: invoiceSequences.prefix,
          nextNumber: invoiceSequences.nextNumber,
          padding: invoiceSequences.padding,
        })
        .from(invoiceSequences)
        .where(eq(invoiceSequences.userId, userId))
        .limit(1);

      if (result.length === 0) {
        // Create default sequence if not exists
        await db.insert(invoiceSequences).values({
          userId,
        });

        res.json({
          prefix: "INV",
          nextNumber: 1,
          padding: 4,
          previewNumber: "INV0001",
        });
        return;
      }

      const settings = result[0]!;
      const previewNumber =
        settings.prefix +
        String(settings.nextNumber).padStart(settings.padding ?? 4, "0");

      res.json({
        prefix: settings.prefix,
        nextNumber: settings.nextNumber,
        padding: settings.padding,
        previewNumber,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Update invoice settings
router.put(
  "/invoice",
  [
    body("prefix")
      .optional()
      .trim()
      .isLength({ max: 20 })
      .withMessage("Prefix cannot exceed 20 characters"),
    body("padding")
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage("Padding must be between 1 and 10"),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const { prefix, padding } = req.body;

      // Get current settings
      const currentResult = await db
        .select()
        .from(invoiceSequences)
        .where(eq(invoiceSequences.userId, userId))
        .limit(1);

      if (currentResult.length === 0) {
        // Create sequence with provided values
        await db.insert(invoiceSequences).values({
          userId,
          prefix: prefix || "INV",
          padding: padding || 4,
        });
      } else {
        const current = currentResult[0]!;
        await db
          .update(invoiceSequences)
          .set({
            prefix: prefix ?? current.prefix,
            padding: padding ?? current.padding,
          })
          .where(eq(invoiceSequences.userId, userId));
      }

      // Get updated settings
      const result = await db
        .select({
          prefix: invoiceSequences.prefix,
          nextNumber: invoiceSequences.nextNumber,
          padding: invoiceSequences.padding,
        })
        .from(invoiceSequences)
        .where(eq(invoiceSequences.userId, userId))
        .limit(1);

      const settings = result[0]!;
      const previewNumber =
        settings.prefix +
        String(settings.nextNumber).padStart(settings.padding ?? 4, "0");

      res.json({
        message: "Invoice settings updated successfully",
        settings: {
          prefix: settings.prefix,
          nextNumber: settings.nextNumber,
          padding: settings.padding,
          previewNumber,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get user's invoice templates
router.get(
  "/templates",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;

      const result = await db
        .select()
        .from(invoiceTemplates)
        .where(eq(invoiceTemplates.userId, userId))
        .orderBy(invoiceTemplates.isDefault, invoiceTemplates.name);

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

// Create a new template
router.post(
  "/templates",
  [
    body("name").trim().notEmpty().withMessage("Template name is required"),
    body("primaryColor")
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage("Invalid color format"),
    body("isDefault").optional().isBoolean(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const { name, primaryColor = "#4A5568", isDefault = false } = req.body;

      // If setting as default, unset other defaults
      if (isDefault) {
        await db
          .update(invoiceTemplates)
          .set({ isDefault: false })
          .where(eq(invoiceTemplates.userId, userId));
      }

      const result = await db
        .insert(invoiceTemplates)
        .values({
          userId,
          name,
          primaryColor,
          isDefault,
        })
        .returning();

      res.status(201).json(result[0]);
    } catch (error) {
      next(error);
    }
  },
);

// Update a template
router.put(
  "/templates/:id",
  [
    param("id").isUUID().withMessage("Invalid template ID"),
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Template name cannot be empty"),
    body("primaryColor")
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage("Invalid color format"),
    body("isDefault").optional().isBoolean(),
  ],
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const templateId = String(id);
      const { name, primaryColor, isDefault } = req.body;

      // Check if template exists and belongs to user
      const existing = await db
        .select()
        .from(invoiceTemplates)
        .where(
          and(
            eq(invoiceTemplates.id, templateId),
            eq(invoiceTemplates.userId, userId),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        throw new NotFoundError("Template not found");
      }

      const current = existing[0]!;

      // If setting as default, unset other defaults
      if (isDefault) {
        await db
          .update(invoiceTemplates)
          .set({ isDefault: false })
          .where(
            and(
              eq(invoiceTemplates.userId, userId),
              eq(invoiceTemplates.id, templateId),
            ),
          );
      }

      const result = await db
        .update(invoiceTemplates)
        .set({
          name: name ?? current.name,
          primaryColor: primaryColor ?? current.primaryColor,
          isDefault: isDefault ?? current.isDefault,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(invoiceTemplates.id, templateId),
            eq(invoiceTemplates.userId, userId),
          ),
        )
        .returning();

      res.json(result[0]);
    } catch (error) {
      next(error);
    }
  },
);

// Delete a template
router.delete(
  "/templates/:id",
  param("id").isUUID().withMessage("Invalid template ID"),
  validate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.userId!;
      const templateId = String(id);

      const result = await db
        .delete(invoiceTemplates)
        .where(
          and(
            eq(invoiceTemplates.id, templateId),
            eq(invoiceTemplates.userId, userId),
          ),
        )
        .returning({ id: invoiceTemplates.id });

      if (result.length === 0) {
        throw new NotFoundError("Template not found");
      }

      res.json({ message: "Template deleted successfully" });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
