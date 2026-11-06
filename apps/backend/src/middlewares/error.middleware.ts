import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('🚨 Core Error Context:', err.stack || err);

  const status = typeof err.status === 'number' && err.status >= 400 && err.status < 500
    ? err.status
    : 500;
  res.status(status).json({
    success: false,
    error: status === 500 ? 'An unexpected server error occurred.' : err.message,
  });
}
