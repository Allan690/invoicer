import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { db, users } from '../db/index.js';
import { eq } from 'drizzle-orm';
import type { JwtPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Fetch user from database to ensure they still exist
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
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach user to request object
    req.user = result[0];
    req.userId = decoded.userId;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return decoded;
};

export default {
  authenticateToken,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
};
