import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { config } from './env';
import { logger } from './logger';
export const initSentry = () => {
  if (!config.SENTRY_DSN) {
    logger.warn('Sentry DSN not configured, error tracking disabled');
    return;
  }
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    release: config.APP_VERSION || '1.0.0',
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event, hint) {
      if (config.NODE_ENV === 'development') {
        logger.debug('Sentry event:', { event, hint });
      }
      return event;
    },
    beforeSendTransaction(event) {
      if (config.NODE_ENV === 'development') {
        logger.debug('Sentry transaction:', event);
      }
      return event;
    }
  });
  logger.info('Sentry initialized successfully');
};
export const captureException = (error: Error, context?: Record<string, any>) => {
  if (config.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context) {
        Object.keys(context).forEach(key => {
          scope.setContext(key, context[key]);
        });
      }
      Sentry.captureException(error);
    });
  }
  logger.error('Exception captured', {
    error: error.message,
    stack: error.stack,
    context
  });
};
export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) => {
  if (config.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context) {
        Object.keys(context).forEach(key => {
          scope.setContext(key, context[key]);
        });
      }
      Sentry.captureMessage(message, level);
    });
  }
  logger.log(level, message, context);
};
export const setUserContext = (user: { id: string; email?: string; username?: string }) => {
  if (config.SENTRY_DSN) {
    const sentryUser: any = { id: user.id };
    if (user.email) sentryUser.email = user.email;
    if (user.username) sentryUser.username = user.username;
    Sentry.setUser(sentryUser);
  }
};
export const addBreadcrumb = (message: string, category: string, data?: Record<string, any>) => {
  if (config.SENTRY_DSN) {
    const breadcrumb: any = {
      message,
      category,
      timestamp: Date.now() / 1000
    };
    if (data) breadcrumb.data = data;
    Sentry.addBreadcrumb(breadcrumb);
  }
};
export { Sentry };
export default Sentry;
