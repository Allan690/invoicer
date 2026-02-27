import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

// Get dashboard overview statistics
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { year, month } = req.query;

    // Default to current year if not specified
    const currentYear = year || new Date().getFullYear();

    // Total revenue (all time)
    const totalRevenueResult = await query(
      `SELECT COALESCE(SUM(amount_paid), 0) as total_revenue
       FROM invoices
       WHERE user_id = $1 AND status != 'cancelled'`,
      [userId]
    );

    // Outstanding balance (all unpaid invoices)
    const outstandingResult = await query(
      `SELECT COALESCE(SUM(balance_due), 0) as total_outstanding
       FROM invoices
       WHERE user_id = $1 AND status NOT IN ('paid', 'cancelled') AND balance_due > 0`,
      [userId]
    );

    // Overdue amount
    const overdueResult = await query(
      `SELECT COALESCE(SUM(balance_due), 0) as total_overdue, COUNT(*) as overdue_count
       FROM invoices
       WHERE user_id = $1
         AND status NOT IN ('paid', 'cancelled')
         AND due_date < CURRENT_DATE
         AND balance_due > 0`,
      [userId]
    );

    // Invoice counts by status
    const invoiceCountsResult = await query(
      `SELECT
         status,
         COUNT(*) as count,
         COALESCE(SUM(total), 0) as total_amount
       FROM invoices
       WHERE user_id = $1
       GROUP BY status`,
      [userId]
    );

    // This year's revenue
    const yearRevenueResult = await query(
      `SELECT COALESCE(SUM(amount_paid), 0) as year_revenue
       FROM invoices
       WHERE user_id = $1
         AND status != 'cancelled'
         AND EXTRACT(YEAR FROM issue_date) = $2`,
      [userId, currentYear]
    );

    // This month's revenue
    const currentMonth = month || new Date().getMonth() + 1;
    const monthRevenueResult = await query(
      `SELECT COALESCE(SUM(amount_paid), 0) as month_revenue
       FROM invoices
       WHERE user_id = $1
         AND status != 'cancelled'
         AND EXTRACT(YEAR FROM issue_date) = $2
         AND EXTRACT(MONTH FROM issue_date) = $3`,
      [userId, currentYear, currentMonth]
    );

    // Client count
    const clientCountResult = await query(
      `SELECT COUNT(*) as client_count FROM clients WHERE user_id = $1`,
      [userId]
    );

    // Recent activity - last 5 invoices
    const recentInvoicesResult = await query(
      `SELECT
         i.id, i.invoice_number, i.status, i.total, i.balance_due, i.issue_date,
         c.name as client_name, c.company_name as client_company
       FROM invoices i
       JOIN clients c ON i.client_id = c.id
       WHERE i.user_id = $1
       ORDER BY i.created_at DESC
       LIMIT 5`,
      [userId]
    );

    // Build status counts object
    const statusCounts = {};
    invoiceCountsResult.rows.forEach(row => {
      statusCounts[row.status] = {
        count: parseInt(row.count),
        totalAmount: parseFloat(row.total_amount)
      };
    });

    res.json({
      totalRevenue: parseFloat(totalRevenueResult.rows[0].total_revenue),
      totalOutstanding: parseFloat(outstandingResult.rows[0].total_outstanding),
      totalOverdue: parseFloat(overdueResult.rows[0].total_overdue),
      overdueCount: parseInt(overdueResult.rows[0].overdue_count),
      yearRevenue: parseFloat(yearRevenueResult.rows[0].year_revenue),
      monthRevenue: parseFloat(monthRevenueResult.rows[0].month_revenue),
      clientCount: parseInt(clientCountResult.rows[0].client_count),
      invoicesByStatus: statusCounts,
      recentInvoices: recentInvoicesResult.rows,
      currentYear: parseInt(currentYear),
      currentMonth: parseInt(currentMonth)
    });
  } catch (error) {
    next(error);
  }
});

// Get monthly revenue for chart
router.get('/revenue/monthly', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { year } = req.query;
    const currentYear = year || new Date().getFullYear();

    const result = await query(
      `SELECT
         EXTRACT(MONTH FROM issue_date)::int as month,
         COALESCE(SUM(amount_paid), 0) as revenue,
         COALESCE(SUM(total), 0) as invoiced,
         COUNT(*) as invoice_count
       FROM invoices
       WHERE user_id = $1
         AND status != 'cancelled'
         AND EXTRACT(YEAR FROM issue_date) = $2
       GROUP BY EXTRACT(MONTH FROM issue_date)
       ORDER BY month`,
      [userId, currentYear]
    );

    // Fill in missing months with zeros
    const monthlyData = [];
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    for (let i = 1; i <= 12; i++) {
      const found = result.rows.find(r => r.month === i);
      monthlyData.push({
        month: i,
        monthName: monthNames[i - 1],
        revenue: found ? parseFloat(found.revenue) : 0,
        invoiced: found ? parseFloat(found.invoiced) : 0,
        invoiceCount: found ? parseInt(found.invoice_count) : 0
      });
    }

    res.json({
      year: parseInt(currentYear),
      data: monthlyData,
      totals: {
        revenue: monthlyData.reduce((sum, m) => sum + m.revenue, 0),
        invoiced: monthlyData.reduce((sum, m) => sum + m.invoiced, 0),
        invoiceCount: monthlyData.reduce((sum, m) => sum + m.invoiceCount, 0)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get top clients by revenue
router.get('/clients/top', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { limit = 5 } = req.query;

    const result = await query(
      `SELECT
         c.id,
         c.name,
         c.company_name,
         c.email,
         COUNT(i.id) as invoice_count,
         COALESCE(SUM(i.total), 0) as total_billed,
         COALESCE(SUM(i.amount_paid), 0) as total_paid,
         COALESCE(SUM(i.balance_due), 0) as outstanding
       FROM clients c
       LEFT JOIN invoices i ON c.id = i.client_id AND i.status != 'cancelled'
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY total_paid DESC
       LIMIT $2`,
      [userId, parseInt(limit)]
    );

    res.json({
      clients: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        companyName: row.company_name,
        email: row.email,
        invoiceCount: parseInt(row.invoice_count),
        totalBilled: parseFloat(row.total_billed),
        totalPaid: parseFloat(row.total_paid),
        outstanding: parseFloat(row.outstanding)
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Get invoices due soon
router.get('/invoices/due-soon', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { days = 7 } = req.query;

    const result = await query(
      `SELECT
         i.id, i.invoice_number, i.status, i.total, i.balance_due,
         i.issue_date, i.due_date,
         c.name as client_name, c.company_name as client_company, c.email as client_email
       FROM invoices i
       JOIN clients c ON i.client_id = c.id
       WHERE i.user_id = $1
         AND i.status NOT IN ('paid', 'cancelled')
         AND i.due_date IS NOT NULL
         AND i.due_date <= CURRENT_DATE + INTERVAL '1 day' * $2
         AND i.due_date >= CURRENT_DATE
         AND i.balance_due > 0
       ORDER BY i.due_date ASC`,
      [userId, parseInt(days)]
    );

    res.json({
      daysAhead: parseInt(days),
      invoices: result.rows.map(row => ({
        ...row,
        total: parseFloat(row.total),
        balanceDue: parseFloat(row.balance_due),
        daysUntilDue: Math.ceil((new Date(row.due_date) - new Date()) / (1000 * 60 * 60 * 24))
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Get overdue invoices
router.get('/invoices/overdue', async (req, res, next) => {
  try {
    const userId = req.userId;

    const result = await query(
      `SELECT
         i.id, i.invoice_number, i.status, i.total, i.balance_due,
         i.issue_date, i.due_date,
         c.name as client_name, c.company_name as client_company, c.email as client_email
       FROM invoices i
       JOIN clients c ON i.client_id = c.id
       WHERE i.user_id = $1
         AND i.status NOT IN ('paid', 'cancelled')
         AND i.due_date < CURRENT_DATE
         AND i.balance_due > 0
       ORDER BY i.due_date ASC`,
      [userId]
    );

    res.json({
      invoices: result.rows.map(row => ({
        ...row,
        total: parseFloat(row.total),
        balanceDue: parseFloat(row.balance_due),
        daysOverdue: Math.ceil((new Date() - new Date(row.due_date)) / (1000 * 60 * 60 * 24))
      }))
    });
  } catch (error) {
    next(error);
  }
});

// Get available years for filtering
router.get('/years', async (req, res, next) => {
  try {
    const userId = req.userId;

    const result = await query(
      `SELECT DISTINCT EXTRACT(YEAR FROM issue_date)::int as year
       FROM invoices
       WHERE user_id = $1
       ORDER BY year DESC`,
      [userId]
    );

    const years = result.rows.map(r => r.year);

    // Add current year if not present
    const currentYear = new Date().getFullYear();
    if (!years.includes(currentYear)) {
      years.unshift(currentYear);
    }

    res.json({ years });
  } catch (error) {
    next(error);
  }
});

export default router;
