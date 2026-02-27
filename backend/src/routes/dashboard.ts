import { Router, type Router as RouterType } from "express";
import { eq, and, ne, lt, gte, sql, count } from "drizzle-orm";
import { db, invoices, clients } from "../db/index.js";
import type { Request, Response, NextFunction } from "express";

const router: RouterType = Router();

// Get dashboard overview statistics
router.get(
  "/stats",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const { year, month } = req.query;

      // Default to current year if not specified
      const currentYear = year
        ? parseInt(year as string, 10)
        : new Date().getFullYear();
      const currentMonth = month
        ? parseInt(month as string, 10)
        : new Date().getMonth() + 1;

      // Total revenue (all time)
      const totalRevenueResult = await db
        .select({
          totalRevenue: sql<number>`coalesce(sum(${invoices.amountPaid}::numeric), 0)`,
        })
        .from(invoices)
        .where(
          and(eq(invoices.userId, userId), ne(invoices.status, "cancelled")),
        );

      // Outstanding balance (all unpaid invoices)
      const outstandingResult = await db
        .select({
          totalOutstanding: sql<number>`coalesce(sum(${invoices.balanceDue}::numeric), 0)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            sql`${invoices.status} NOT IN ('paid', 'cancelled')`,
            sql`${invoices.balanceDue}::numeric > 0`,
          ),
        );

      // Overdue amount
      const overdueResult = await db
        .select({
          totalOverdue: sql<number>`coalesce(sum(${invoices.balanceDue}::numeric), 0)`,
          overdueCount: count(),
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            sql`${invoices.status} NOT IN ('paid', 'cancelled')`,
            lt(invoices.dueDate, sql`CURRENT_DATE`),
            sql`${invoices.balanceDue}::numeric > 0`,
          ),
        );

      // Invoice counts by status
      const invoiceCountsResult = await db
        .select({
          status: invoices.status,
          count: count(),
          totalAmount: sql<number>`coalesce(sum(${invoices.total}::numeric), 0)`,
        })
        .from(invoices)
        .where(eq(invoices.userId, userId))
        .groupBy(invoices.status);

      // This year's revenue
      const yearRevenueResult = await db
        .select({
          yearRevenue: sql<number>`coalesce(sum(${invoices.amountPaid}::numeric), 0)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            ne(invoices.status, "cancelled"),
            sql`EXTRACT(YEAR FROM ${invoices.issueDate}) = ${currentYear}`,
          ),
        );

      // This month's revenue
      const monthRevenueResult = await db
        .select({
          monthRevenue: sql<number>`coalesce(sum(${invoices.amountPaid}::numeric), 0)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            ne(invoices.status, "cancelled"),
            sql`EXTRACT(YEAR FROM ${invoices.issueDate}) = ${currentYear}`,
            sql`EXTRACT(MONTH FROM ${invoices.issueDate}) = ${currentMonth}`,
          ),
        );

      // Client count
      const clientCountResult = await db
        .select({ clientCount: count() })
        .from(clients)
        .where(eq(clients.userId, userId));

      // Recent activity - last 5 invoices
      const recentInvoicesResult = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          status: invoices.status,
          total: invoices.total,
          balanceDue: invoices.balanceDue,
          issueDate: invoices.issueDate,
          clientName: clients.name,
          clientCompany: clients.companyName,
        })
        .from(invoices)
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(eq(invoices.userId, userId))
        .orderBy(sql`${invoices.createdAt} DESC`)
        .limit(5);

      // Build status counts object
      const statusCounts: Record<
        string,
        { count: number; totalAmount: number }
      > = {};
      invoiceCountsResult.forEach((row) => {
        if (row.status) {
          statusCounts[row.status] = {
            count: Number(row.count),
            totalAmount: Number(row.totalAmount),
          };
        }
      });

      res.json({
        totalRevenue: Number(totalRevenueResult[0]?.totalRevenue ?? 0),
        totalOutstanding: Number(outstandingResult[0]?.totalOutstanding ?? 0),
        totalOverdue: Number(overdueResult[0]?.totalOverdue ?? 0),
        overdueCount: Number(overdueResult[0]?.overdueCount ?? 0),
        yearRevenue: Number(yearRevenueResult[0]?.yearRevenue ?? 0),
        monthRevenue: Number(monthRevenueResult[0]?.monthRevenue ?? 0),
        clientCount: Number(clientCountResult[0]?.clientCount ?? 0),
        invoicesByStatus: statusCounts,
        recentInvoices: recentInvoicesResult,
        currentYear,
        currentMonth,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get monthly revenue for chart
router.get(
  "/revenue/monthly",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const { year } = req.query;
      const currentYear = year
        ? parseInt(year as string, 10)
        : new Date().getFullYear();

      const result = await db
        .select({
          month: sql<number>`EXTRACT(MONTH FROM ${invoices.issueDate})::int`,
          revenue: sql<number>`coalesce(sum(${invoices.amountPaid}::numeric), 0)`,
          invoiced: sql<number>`coalesce(sum(${invoices.total}::numeric), 0)`,
          invoiceCount: count(),
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, userId),
            ne(invoices.status, "cancelled"),
            sql`EXTRACT(YEAR FROM ${invoices.issueDate}) = ${currentYear}`,
          ),
        )
        .groupBy(sql`EXTRACT(MONTH FROM ${invoices.issueDate})`)
        .orderBy(sql`EXTRACT(MONTH FROM ${invoices.issueDate})`);

      // Fill in missing months with zeros
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      const monthlyData = [];
      for (let i = 1; i <= 12; i++) {
        const found = result.find((r) => r.month === i);
        monthlyData.push({
          month: i,
          monthName: monthNames[i - 1],
          revenue: found ? Number(found.revenue) : 0,
          invoiced: found ? Number(found.invoiced) : 0,
          invoiceCount: found ? Number(found.invoiceCount) : 0,
        });
      }

      res.json({
        year: currentYear,
        data: monthlyData,
        totals: {
          revenue: monthlyData.reduce((sum, m) => sum + m.revenue, 0),
          invoiced: monthlyData.reduce((sum, m) => sum + m.invoiced, 0),
          invoiceCount: monthlyData.reduce((sum, m) => sum + m.invoiceCount, 0),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get top clients by revenue
router.get(
  "/clients/top",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const { limit = "5" } = req.query;
      const limitNum = parseInt(limit as string, 10);

      const result = await db
        .select({
          id: clients.id,
          name: clients.name,
          companyName: clients.companyName,
          email: clients.email,
          invoiceCount: count(invoices.id),
          totalBilled: sql<number>`coalesce(sum(case when ${invoices.status} != 'cancelled' then ${invoices.total}::numeric else 0 end), 0)`,
          totalPaid: sql<number>`coalesce(sum(case when ${invoices.status} != 'cancelled' then ${invoices.amountPaid}::numeric else 0 end), 0)`,
          outstanding: sql<number>`coalesce(sum(case when ${invoices.status} != 'cancelled' then ${invoices.balanceDue}::numeric else 0 end), 0)`,
        })
        .from(clients)
        .leftJoin(invoices, eq(clients.id, invoices.clientId))
        .where(eq(clients.userId, userId))
        .groupBy(clients.id)
        .orderBy(sql`total_paid DESC`)
        .limit(limitNum);

      res.json({
        clients: result.map((row) => ({
          id: row.id,
          name: row.name,
          companyName: row.companyName,
          email: row.email,
          invoiceCount: Number(row.invoiceCount),
          totalBilled: Number(row.totalBilled),
          totalPaid: Number(row.totalPaid),
          outstanding: Number(row.outstanding),
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get invoices due soon
router.get(
  "/invoices/due-soon",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const { days = "7" } = req.query;
      const daysNum = parseInt(days as string, 10);

      const result = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          status: invoices.status,
          total: invoices.total,
          balanceDue: invoices.balanceDue,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          clientName: clients.name,
          clientCompany: clients.companyName,
          clientEmail: clients.email,
        })
        .from(invoices)
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(
          and(
            eq(invoices.userId, userId),
            sql`${invoices.status} NOT IN ('paid', 'cancelled')`,
            sql`${invoices.dueDate} IS NOT NULL`,
            sql`${invoices.dueDate} <= CURRENT_DATE + INTERVAL '1 day' * ${daysNum}`,
            gte(invoices.dueDate, sql`CURRENT_DATE`),
            sql`${invoices.balanceDue}::numeric > 0`,
          ),
        )
        .orderBy(invoices.dueDate);

      res.json({
        daysAhead: daysNum,
        invoices: result.map((row) => ({
          ...row,
          total: Number(row.total),
          balanceDue: Number(row.balanceDue),
          daysUntilDue: row.dueDate
            ? Math.ceil(
                (new Date(row.dueDate).getTime() - new Date().getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : null,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get overdue invoices
router.get(
  "/invoices/overdue",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;

      const result = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          status: invoices.status,
          total: invoices.total,
          balanceDue: invoices.balanceDue,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          clientName: clients.name,
          clientCompany: clients.companyName,
          clientEmail: clients.email,
        })
        .from(invoices)
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(
          and(
            eq(invoices.userId, userId),
            sql`${invoices.status} NOT IN ('paid', 'cancelled')`,
            lt(invoices.dueDate, sql`CURRENT_DATE`),
            sql`${invoices.balanceDue}::numeric > 0`,
          ),
        )
        .orderBy(invoices.dueDate);

      res.json({
        invoices: result.map((row) => ({
          ...row,
          total: Number(row.total),
          balanceDue: Number(row.balanceDue),
          daysOverdue: row.dueDate
            ? Math.ceil(
                (new Date().getTime() - new Date(row.dueDate).getTime()) /
                  (1000 * 60 * 60 * 24),
              )
            : null,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get available years for filtering
router.get(
  "/years",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;

      const result = await db
        .selectDistinct({
          year: sql<number>`EXTRACT(YEAR FROM ${invoices.issueDate})::int`,
        })
        .from(invoices)
        .where(eq(invoices.userId, userId))
        .orderBy(sql`year DESC`);

      const years = result.map((r) => r.year);

      // Add current year if not present
      const currentYear = new Date().getFullYear();
      if (!years.includes(currentYear)) {
        years.unshift(currentYear);
      }

      res.json({ years });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
