export interface ConsumerConfig {
  queueName: string;
  prefetch: number;
  autoAck: boolean;
  retryAttempts: number;
  retryDelay: number;
}
export interface MessageProcessingFlow {
  1: 'Receive message from queue';
  2: 'Validate message data';
  3: 'Create or find conversation';
  4: 'Create Message document';
  5: 'Send Socket.IO notification';
  6: 'Update AutoMessage status';
  7: 'Acknowledge message';
}
export interface AutoMessageNotification {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderInfo: {
    _id: string;
    username: string;
    email: string;
  };
  content: string;
  createdAt: string;
  isAutoMessage: true;
}
export interface ConsumerStats {
  isRunning: boolean;
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
  lastProcessedAt: Date | null;
  averageProcessingTime: number;
}
export interface ConsumerError {
  messageId: string;
  error: string;
  timestamp: Date;
  retryCount: number;
}
export const CONSUMER_EVENTS = {
  MESSAGE_PROCESSED: 'message_processed',
  MESSAGE_FAILED: 'message_failed',
  CONSUMER_STARTED: 'consumer_started',
  CONSUMER_STOPPED: 'consumer_stopped',
  CONSUMER_ERROR: 'consumer_error'
} as const;
export type ConsumerEvent = typeof CONSUMER_EVENTS[keyof typeof CONSUMER_EVENTS];
