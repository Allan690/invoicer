import type { Request, Response, NextFunction } from "express";

// Custom error classes
export class AppError extends Error {
  statusCode: number;
  status: number;
  isOperational: boolean;
  details?: unknown;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details: unknown = null) {
    super(message, 400);
    this.name = "ValidationError";
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, 409);
    this.name = "ConflictError";
  }
}

// PostgreSQL error codes
interface PgError extends Error {
  code?: string;
}

// Error handler middleware
export const errorHandler = (
  err: Error | AppError | PgError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  console.error("Error:", err);

  // Handle custom application errors
  if (err instanceof AppError) {
    const response: Record<string, unknown> = {
      error: err.name.replace("Error", "") || "Error",
      message: err.message,
    };
    if (err.details) {
      response.details = err.details;
    }
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle specific error types by name
  if (err.name === "ValidationError") {
    res.status(400).json({
      error: "Validation Error",
      details: (err as AppError).details || err.message,
    });
    return;
  }

  if (err.name === "UnauthorizedError") {
    res.status(401).json({
      error: "Unauthorized",
      message: err.message || "Authentication required",
    });
    return;
  }

  if (err.name === "ForbiddenError") {
    res.status(403).json({
      error: "Forbidden",
      message: err.message || "Access denied",
    });
    return;
  }

  if (err.name === "NotFoundError") {
    res.status(404).json({
      error: "Not Found",
      message: err.message || "Resource not found",
    });
    return;
  }

  // Handle PostgreSQL errors
  const pgErr = err as PgError;
  if (pgErr.code) {
    switch (pgErr.code) {
      case "23505": // unique_violation
        res.status(409).json({
          error: "Conflict",
          message: "A record with this value already exists",
        });
        return;
      case "23503": // foreign_key_violation
        res.status(400).json({
          error: "Bad Request",
          message: "Referenced record does not exist",
        });
        return;
      case "23502": // not_null_violation
        res.status(400).json({
          error: "Bad Request",
          message: "Required field is missing",
        });
        return;
      case "22P02": // invalid_text_representation (invalid UUID)
        res.status(400).json({
          error: "Bad Request",
          message: "Invalid ID format",
        });
        return;
      default:
        console.error("PostgreSQL error code:", pgErr.code);
    }
  }

  // Handle JWT errors
  if (err.name === "TokenExpiredError") {
    res.status(401).json({
      error: "Unauthorized",
      message: "Token expired",
    });
    return;
  }

  if (err.name === "JsonWebTokenError") {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid token",
    });
    return;
  }

  // Default error response
  const statusCode = (err as AppError).statusCode || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Something went wrong";

  const response: Record<string, unknown> = {
    error: statusCode === 500 ? "Internal Server Error" : "Error",
    message,
  };

  if (process.env.NODE_ENV !== "production") {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
