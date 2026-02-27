import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';
import { generateToken, generateRefreshToken, verifyRefreshToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Register a new user
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, fullName, businessName } = req.body;

    // Validate required fields
    if (!email || !password || !fullName) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email, password, and full name are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid email format'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, business_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, business_name, default_currency, created_at`,
      [email.toLowerCase(), passwordHash, fullName, businessName || null]
    );

    const user = result.rows[0];

    // Create default invoice sequence for user
    await query(
      'INSERT INTO invoice_sequences (user_id) VALUES ($1)',
      [user.id]
    );

    // Generate tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        businessName: user.business_name,
        defaultCurrency: user.default_currency
      },
      token,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email and password are required'
      });
    }

    // Find user
    const result = await query(
      `SELECT id, email, password_hash, full_name, business_name, default_currency, address, phone
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password'
      });
    }

    // Generate tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        businessName: user.business_name,
        defaultCurrency: user.default_currency,
        address: user.address,
        phone: user.phone
      },
      token,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Check if user still exists
    const result = await query(
      'SELECT id, email, full_name, business_name, default_currency FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    // Generate new tokens
    const newToken = generateToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    res.json({
      message: 'Token refreshed successfully',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        businessName: user.business_name,
        defaultCurrency: user.default_currency
      },
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token expired'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid refresh token'
      });
    }
    next(error);
  }
});

// Get current user (protected route)
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, email, full_name, business_name, address, phone, logo_url,
              default_currency, tax_number, bank_name, bank_account_number, bank_sort_code, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found'
      });
    }

    const user = result.rows[0];

    res.json({
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
        createdAt: user.created_at
      }
    });
  } catch (error) {
    next(error);
  }
});

// Logout (client-side should remove tokens, this endpoint is for any server-side cleanup)
router.post('/logout', authenticateToken, (req, res) => {
  // In a more complex setup, you might invalidate the token here
  // by adding it to a blacklist or removing from a whitelist
  res.json({
    message: 'Logged out successfully'
  });
});

export default router;
