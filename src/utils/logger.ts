import { logger } from '../config/logger';
import { captureException, captureMessage, addBreadcrumb } from '../config/sentry';
import { Request } from 'express';

export interface LogContext {
  userId?: string;
  requestId?: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number | undefined;
  [key: string]: any;
}

export class Logger {
  static info(message: string, context?: LogContext) {
    logger.info(message, context);
    if (context) {
      addBreadcrumb(message, 'info', context);
    }
  }

  static warn(message: string, context?: LogContext) {
    logger.warn(message, context);
    captureMessage(message, 'warning', context);
  }

  static error(message: string, error?: Error, context?: LogContext) {
    const logContext = {
      ...context,
      error: error?.message,
      stack: error?.stack
    };
    
    logger.error(message, logContext);
    
    if (error) {
      captureException(error, context);
    } else {
      captureMessage(message, 'error', context);
    }
  }

  static debug(message: string, context?: LogContext) {
    logger.debug(message, context);
  }

  static http(message: string, context?: LogContext) {
    logger.http(message, context);
  }

  static auth(message: string, context?: LogContext) {
    const authContext = { ...context, category: 'auth' };
    logger.info(`[AUTH] ${message}`, authContext);
    addBreadcrumb(message, 'auth', authContext);
  }

  static security(message: string, context?: LogContext) {
    const securityContext = { ...context, category: 'security' };
    logger.warn(`[SECURITY] ${message}`, securityContext);
    captureMessage(`[SECURITY] ${message}`, 'warning', securityContext);
  }

  static database(message: string, context?: LogContext) {
    const dbContext = { ...context, category: 'database' };
    logger.info(`[DB] ${message}`, dbContext);
    addBreadcrumb(message, 'database', dbContext);
  }

  static performance(message: string, duration: number, context?: LogContext) {
    const perfContext = { 
      ...context, 
      category: 'performance',
      duration: `${duration}ms`
    };
    
    if (duration > 1000) {
      logger.warn(`[PERFORMANCE] ${message} - Slow operation: ${duration}ms`, perfContext);
      captureMessage(`[PERFORMANCE] ${message} - Slow operation: ${duration}ms`, 'warning', perfContext);
    } else {
      logger.info(`[PERFORMANCE] ${message} - ${duration}ms`, perfContext);
    }
  }

  static api(_message: string, req: Request, statusCode: number, responseTime?: number) {
    const apiContext: LogContext = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode,
      responseTime,
      userId: (req as any).user?.userId,
      category: 'api'
    };

    const logMessage = `${req.method} ${req.originalUrl} - ${statusCode}${responseTime ? ` - ${responseTime}ms` : ''}`;
    
    if (statusCode >= 400) {
      logger.error(`[API] ${logMessage}`, apiContext);
      if (statusCode >= 500) {
        captureMessage(`[API] ${logMessage}`, 'error', apiContext);
      }
    } else {
      logger.http(`[API] ${logMessage}`, apiContext);
    }
  }

  static sanitizeForLogging(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password', 'token', 'accessToken', 'refreshToken', 
      'authorization', 'cookie', 'session', 'secret',
      'key', 'apiKey', 'privateKey', 'publicKey'
    ];

    const sanitized = { ...data };

    const sanitizeObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
      }

      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          if (sensitiveFields.some(field => lowerKey.includes(field))) {
            result[key] = '[REDACTED]';
          } else {
            result[key] = sanitizeObject(value);
          }
        }
        return result;
      }

      return obj;
    };

    return sanitizeObject(sanitized);
  }
}

export default Logger;
