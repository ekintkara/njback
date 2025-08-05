import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { initSentry } from './config/sentry';
import { errorHandler } from './api/middlewares/error.middleware';
import { requestLoggingMiddleware, errorLoggingMiddleware } from './api/middlewares/logging.middleware';
import authRoutes from './api/routes/auth.routes';
import userRoutes from './api/routes/user.routes';
import conversationRoutes from './api/routes/conversation.routes';
import messageRoutes from './api/routes/message.routes';
import Logger from './utils/logger';

export function createApp(): Application {
  initSentry();

  const app: Application = express();

  app.use(helmet());

  app.use(cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  app.use(requestLoggingMiddleware);

  const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    max: config.RATE_LIMIT_MAX_REQUESTS,
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later',
      errorCode: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use(limiter);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      environment: config.NODE_ENV
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/messages', messageRoutes);

  app.use('*', (req: Request, res: Response) => {
    Logger.warn(`Route not found: ${req.method} ${req.originalUrl}`, {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(404).json({
      success: false,
      message: `Route ${req.originalUrl} not found`,
      errorCode: 'ROUTE_NOT_FOUND'
    });
  });

  app.use(errorLoggingMiddleware);
  app.use(errorHandler);

  return app;
}
