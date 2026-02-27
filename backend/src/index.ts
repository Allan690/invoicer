import "dotenv/config";
import express, { type Express } from "express";
import cors from "cors";

// Import routes
import authRoutes from "./routes/auth.js";
import clientRoutes from "./routes/clients.js";
import invoiceRoutes from "./routes/invoices.js";
import settingsRoutes from "./routes/settings.js";
import dashboardRoutes from "./routes/dashboard.js";

// Import middleware
import { authenticateToken } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/clients", authenticateToken, clientRoutes);
app.use("/api/invoices", authenticateToken, invoiceRoutes);
app.use("/api/settings", authenticateToken, settingsRoutes);
app.use("/api/dashboard", authenticateToken, dashboardRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;
