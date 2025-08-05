import { Types } from 'mongoose';
import AutoMessage from '../models/auto-message.model';
import { rabbitmqConfig, QueueMessageData } from '../config/rabbitmq';
import { QueueProcessingResult, PendingMessage, QUEUE_NAMES } from '../types/queue.types';
import Logger from '../utils/logger';
import { AppError } from '../utils/app-error';
export class QueueService {
  private static instance: QueueService;
  private constructor() {}
  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }
  public async processPendingMessages(): Promise<QueueProcessingResult> {
    const result: QueueProcessingResult = {
      processed: 0,
      queued: 0,
      failed: 0,
      errors: []
    };
    try {
      Logger.info('[QUEUE_SERVICE] Starting pending messages processing', {
        category: 'queue'
      });
      const pendingMessages = await this.findPendingMessages();
      result.processed = pendingMessages.length;
      if (pendingMessages.length === 0) {
        Logger.info('[QUEUE_SERVICE] No pending messages found', {
          category: 'queue'
        });
        return result;
      }
      Logger.info('[QUEUE_SERVICE] Found pending messages', {
        count: pendingMessages.length,
        category: 'queue'
      });
      await this.ensureRabbitMQConnection();
      const batchSize = 50;
      const batches = this.createBatches(pendingMessages, batchSize);
      for (const batch of batches) {
        try {
          const batchResult = await this.processBatch(batch);
          result.queued += batchResult.queued;
          result.failed += batchResult.failed;
          result.errors.push(...batchResult.errors);
        } catch (error) {
          Logger.error('[QUEUE_SERVICE] Batch processing failed', error as Error, {
            batchSize: batch.length,
            category: 'queue'
          });
          result.failed += batch.length;
          result.errors.push(`Batch processing failed: ${(error as Error).message}`);
        }
      }
      Logger.info('[QUEUE_SERVICE] Pending messages processing completed', {
        processed: result.processed,
        queued: result.queued,
        failed: result.failed,
        category: 'queue'
      });
      return result;
    } catch (error) {
      Logger.error('[QUEUE_SERVICE] Failed to process pending messages', error as Error, {
        category: 'queue'
      });
      throw new AppError(
        'Failed to process pending messages',
        500,
        'QUEUE_PROCESSING_ERROR'
      );
    }
  }
  private async findPendingMessages(): Promise<PendingMessage[]> {
    try {
      const currentDate = new Date();
      const messages = await AutoMessage.findPendingMessages(currentDate);
      return messages.map(msg => ({
        _id: msg._id,
        senderId: msg.senderId._id || msg.senderId,
        receiverId: msg.receiverId._id || msg.receiverId,
        content: msg.content,
        sendDate: msg.sendDate,
        isQueued: msg.isQueued,
        isSent: msg.isSent
      }));
    } catch (error) {
      Logger.error('[QUEUE_SERVICE] Failed to find pending messages', error as Error, {
        category: 'queue'
      });
      throw error;
    }
  }
  private async ensureRabbitMQConnection(): Promise<void> {
    if (!rabbitmqConfig.isConnectionActive()) {
      Logger.info('[QUEUE_SERVICE] Establishing RabbitMQ connection', {
        category: 'queue'
      });
      await rabbitmqConfig.connect();
    }
  }
  private createBatches<T>(messages: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < messages.length; i += batchSize) {
      batches.push(messages.slice(i, i + batchSize));
    }
    return batches;
  }
  private async processBatch(batch: PendingMessage[]): Promise<QueueProcessingResult> {
    const result: QueueProcessingResult = {
      processed: batch.length,
      queued: 0,
      failed: 0,
      errors: []
    };
    const messageIds: Types.ObjectId[] = [];
    const queueMessages: QueueMessageData[] = [];
    for (const message of batch) {
      try {
        const queueMessage: QueueMessageData = {
          autoMessageId: message._id.toString(),
          senderId: message.senderId.toString(),
          receiverId: message.receiverId.toString(),
          content: message.content,
          originalSendDate: message.sendDate.toISOString(),
          queuedAt: new Date().toISOString()
        };
        queueMessages.push(queueMessage);
        messageIds.push(message._id);
      } catch (error) {
        Logger.error('[QUEUE_SERVICE] Failed to prepare queue message', error as Error, {
          messageId: message._id.toString(),
          category: 'queue'
        });
        result.failed++;
        result.errors.push(`Failed to prepare message ${message._id}: ${(error as Error).message}`);
      }
    }
    for (const queueMessage of queueMessages) {
      try {
        await rabbitmqConfig.sendToQueue(QUEUE_NAMES.MESSAGE_SENDING, queueMessage);
        result.queued++;
        Logger.debug('[QUEUE_SERVICE] Message sent to queue', {
          messageId: queueMessage.autoMessageId,
          category: 'queue'
        });
      } catch (error) {
        Logger.error('[QUEUE_SERVICE] Failed to send message to queue', error as Error, {
          messageId: queueMessage.autoMessageId,
          category: 'queue'
        });
        result.failed++;
        result.errors.push(`Failed to queue message ${queueMessage.autoMessageId}: ${(error as Error).message}`);
      }
    }
    if (result.queued > 0) {
      try {
        const successfulIds = messageIds.slice(0, result.queued);
        await AutoMessage.markAsQueued(successfulIds);
        Logger.info('[QUEUE_SERVICE] Updated message status to queued', {
          count: successfulIds.length,
          category: 'queue'
        });
      } catch (error) {
        Logger.error('[QUEUE_SERVICE] Failed to update message status', error as Error, {
          category: 'queue'
        });
        result.errors.push(`Failed to update database status: ${(error as Error).message}`);
      }
    }
    return result;
  }
  public async getQueueStats(): Promise<{
    pendingCount: number;
    queuedCount: number;
    sentCount: number;
  }> {
    try {
      const [pendingCount, queuedCount, sentCount] = await Promise.all([
        AutoMessage.countDocuments({ 
          sendDate: { $lte: new Date() },
          isQueued: false,
          isSent: false 
        }),
        AutoMessage.countDocuments({ 
          isQueued: true,
          isSent: false 
        }),
        AutoMessage.countDocuments({ 
          isSent: true 
        })
      ]);
      return {
        pendingCount,
        queuedCount,
        sentCount
      };
    } catch (error) {
      Logger.error('[QUEUE_SERVICE] Failed to get queue stats', error as Error, {
        category: 'queue'
      });
      throw error;
    }
  }
}
export const queueService = QueueService.getInstance();
