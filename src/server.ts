import { createApp } from './app';
import { DatabaseConfig } from './config/database';
import { config, validateConfig } from './config/env';

async function startServer(): Promise<void> {
  try {
    validateConfig();

    const database = DatabaseConfig.getInstance();
    await database.connect();

    const app = createApp();

    const server = app.listen(config.PORT, () => {
      console.log(`🚀 Server running on port ${config.PORT}`);
      console.log(`📊 Environment: ${config.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${config.PORT}/health`);
      console.log(`🔐 Auth API: http://localhost:${config.PORT}/api/auth`);
    });

    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        console.log('HTTP server closed');

        try {
          await database.disconnect();
          console.log('Database connection closed');
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
