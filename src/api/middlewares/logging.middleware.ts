import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Logger from '../../utils/logger';
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
    }
  }
}
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  req.requestId = uuidv4();
  req.startTime = Date.now();
  const originalSend = res.send;
  res.send = function(body) {
    const responseTime = Date.now() - req.startTime;
    Logger.api(
      `Request completed`,
      req,
      res.statusCode,
      responseTime
    );
    return originalSend.call(this, body);
  };
  Logger.http(`Request started: ${req.method} ${req.originalUrl}`, {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.userId
  });
  next();
};
export const errorLoggingMiddleware = (error: Error, req: Request, _res: Response, next: NextFunction) => {
  const responseTime = Date.now() - req.startTime;
  Logger.error(
    `Request failed: ${req.method} ${req.originalUrl}`,
    error,
    {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.userId,
      responseTime,
      body: Logger.sanitizeForLogging(req.body),
      query: req.query,
      params: req.params
    }
  );
  next(error);
};
