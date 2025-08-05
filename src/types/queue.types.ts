import { Types } from 'mongoose';
export interface QueueMessageData {
  autoMessageId: string;
  senderId: string;
  receiverId: string;
  content: string;
  originalSendDate: string;
  queuedAt: string;
}
export interface QueueConfig {
  queueName: string;
  durable: boolean;
  persistent: boolean;
  prefetch: number;
}
export interface QueueProcessingResult {
  processed: number;
  queued: number;
  failed: number;
  errors: string[];
}
export interface PendingMessage {
  _id: Types.ObjectId;
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  content: string;
  sendDate: Date;
  isQueued: boolean;
  isSent: boolean;
}
export interface QueueJobStatus {
  isRunning: boolean;
  lastExecution: Date | null;
  nextExecution: Date | null;
  totalProcessed: number;
  totalQueued: number;
  totalErrors: number;
}
export const QUEUE_NAMES = {
  MESSAGE_SENDING: 'message_sending_queue'
} as const;
export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
