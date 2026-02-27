import { Router, type Router as RouterType } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users, invoiceSequences } from "../db/index.js";
import {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  authenticateToken,
} from "../middleware/auth.js";
import type { Request, Response, NextFunction } from "express";

const router: RouterType = Router();

// Register a new user
router.post(
  "/register",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, fullName, businessName } = req.body;

      // Validate required fields
      if (!email || !password || !fullName) {
        res.status(400).json({
          error: "Validation Error",
          message: "Email, password, and full name are required",
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          error: "Validation Error",
          message: "Invalid email format",
        });
        return;
      }

      // Validate password length
      if (password.length < 6) {
        res.status(400).json({
          error: "Validation Error",
          message: "Password must be at least 6 characters long",
        });
        return;
      }

      // Check if user already exists
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser.length > 0) {
        res.status(409).json({
          error: "Conflict",
          message: "User with this email already exists",
        });
        return;
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const result = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          passwordHash,
          fullName,
          businessName: businessName || null,
        })
        .returning({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          businessName: users.businessName,
          defaultCurrency: users.defaultCurrency,
          createdAt: users.createdAt,
        });

      const user = result[0];

      if (!user) {
        throw new Error("Failed to create user");
      }

      // Create default invoice sequence for user
      await db.insert(invoiceSequences).values({
        userId: user.id,
      });

      // Generate tokens
      const token = generateToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          businessName: user.businessName,
          defaultCurrency: user.defaultCurrency,
        },
        token,
        refreshToken,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Login
router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        res.status(400).json({
          error: "Validation Error",
          message: "Email and password are required",
        });
        return;
      }

      // Find user
      const result = await db
        .select({
          id: users.id,
          email: users.email,
          passwordHash: users.passwordHash,
          fullName: users.fullName,
          businessName: users.businessName,
          defaultCurrency: users.defaultCurrency,
          address: users.address,
          phone: users.phone,
        })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (result.length === 0) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Invalid email or password",
        });
        return;
      }

      const user = result[0]!;

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);

      if (!isValidPassword) {
        res.status(401).json({
          error: "Unauthorized",
          message: "Invalid email or password",
        });
        return;
      }

      // Generate tokens
      const token = generateToken(user.id);
      const refreshToken = generateRefreshToken(user.id);

      res.json({
        message: "Login successful",
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          businessName: user.businessName,
          defaultCurrency: user.defaultCurrency,
          address: user.address,
          phone: user.phone,
        },
        token,
        refreshToken,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Refresh token
router.post(
  "/refresh",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          error: "Validation Error",
          message: "Refresh token is required",
        });
        return;
      }

      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Check if user still exists
      const result = await db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          businessName: users.businessName,
          defaultCurrency: users.defaultCurrency,
        })
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);

      if (result.length === 0) {
        res.status(401).json({
          error: "Unauthorized",
          message: "User not found",
        });
        return;
      }

      const user = result[0]!;

      // Generate new tokens
      const newToken = generateToken(user.id);
      const newRefreshToken = generateRefreshToken(user.id);

      res.json({
        message: "Token refreshed successfully",
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          businessName: user.businessName,
          defaultCurrency: user.defaultCurrency,
        },
        token: newToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "TokenExpiredError") {
          res.status(401).json({
            error: "Unauthorized",
            message: "Refresh token expired",
          });
          return;
        }
        if (error.name === "JsonWebTokenError") {
          res.status(401).json({
            error: "Unauthorized",
            message: "Invalid refresh token",
          });
          return;
        }
      }
      next(error);
    }
  },
);

// Get current user (protected route)
router.get(
  "/me",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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
        })
        .from(users)
        .where(eq(users.id, req.userId!))
        .limit(1);

      if (result.length === 0) {
        res.status(404).json({
          error: "Not Found",
          message: "User not found",
        });
        return;
      }

      const user = result[0]!;

      res.json({
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
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Logout (client-side should remove tokens, this endpoint is for any server-side cleanup)
router.post(
  "/logout",
  authenticateToken,
  (_req: Request, res: Response): void => {
    // In a more complex setup, you might invalidate the token here
    // by adding it to a blacklist or removing from a whitelist
    res.json({
      message: "Logged out successfully",
    });
  },
);

export default router;
