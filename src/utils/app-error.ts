export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode: string | undefined;
  constructor(
    message: string,
    statusCode: number = 500,
    errorCode?: string,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
  toJSON() {
    return {
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
    };
  }
}
