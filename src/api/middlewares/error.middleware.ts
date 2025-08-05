import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/app-error';
export const errorHandler = (
  error: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errorCode = 'INTERNAL_ERROR';
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    errorCode = error.errorCode || 'APP_ERROR';
  }
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errorCode = 'VALIDATION_ERROR';
  }
  if (error.name === 'MongoError' && 'code' in error && (error as any).code === 11000) {
    statusCode = 400;
    message = 'Duplicate field value';
    errorCode = 'DUPLICATE_ERROR';
  }
  if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    errorCode = 'INVALID_TOKEN';
  }
  if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errorCode = 'TOKEN_EXPIRED';
  }
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', error);
  }
  res.status(statusCode).json({
    success: false,
    message,
    errorCode,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};
