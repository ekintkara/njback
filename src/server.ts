import { createApp } from './app';
import { DatabaseConfig } from './config/database';
import { config, validateConfig } from './config/env';
import { captureException } from './config/sentry';
import Logger from './utils/logger';
import { SocketService } from './socket/socket.service';
import { jobManager } from './jobs/job-manager';
import { messageSubscriber } from './subscribers/message.subscriber';
import { rabbitmqConfig } from './config/rabbitmq';
import { createServer } from 'http';
process.on('uncaughtException', (error: Error) => {
  Logger.error('Uncaught Exception', error);
  captureException(error);
  process.exit(1);
});
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  const error = new Error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  Logger.error('Unhandled Rejection', error);
  captureException(error);
  process.exit(1);
});
async function startServer(): Promise<void> {
  try {
    validateConfig();
    const database = DatabaseConfig.getInstance();
    await database.connect();
    const app = createApp();
    const httpServer = createServer(app);
    new SocketService(httpServer);
    await rabbitmqConfig.connect();
    await messageSubscriber.start();
    await jobManager.initialize();
    const server = httpServer.listen(config.PORT, () => {
      Logger.info(`🚀 Server running on port ${config.PORT}`, {
        port: config.PORT,
        environment: config.NODE_ENV,
        healthCheck: `http://localhost:${config.PORT}/health`,
        authAPI: `http://localhost:${config.PORT}/api/auth`,
        socketIO: 'Socket.IO server initialized',
        cronJobs: 'Cron jobs initialized'
      });
    });
    const gracefulShutdown = async (signal: string) => {
      Logger.info(`${signal} received. Starting graceful shutdown...`, { signal });
      server.close(async () => {
        Logger.info('HTTP server closed');
        try {
          await messageSubscriber.stop();
          Logger.info('Message subscriber stopped');
          await rabbitmqConfig.disconnect();
          Logger.info('RabbitMQ connection closed');
          await jobManager.shutdown();
          Logger.info('Job manager shutdown completed');
          await database.disconnect();
          Logger.info('Database connection closed');
          process.exit(0);
        } catch (error) {
          Logger.error('Error during graceful shutdown', error as Error);
          process.exit(1);
        }
      });
    };
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    Logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}
startServer();
