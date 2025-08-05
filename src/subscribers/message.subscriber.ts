import * as amqp from 'amqplib';
import { rabbitmqConfig, QueueMessageData } from '../config/rabbitmq';
import { messageConsumerService } from '../services/message-consumer.service';
import { ConsumerConfig, ConsumerStats, CONSUMER_EVENTS } from '../types/consumer.types';
import { socketService } from '../socket/socket.service';
import { userStatusService } from '../services/user-status.service';
import Logger from '../utils/logger';
import { EventEmitter } from 'events';
export class MessageSubscriber extends EventEmitter {
  private static instance: MessageSubscriber;
  private isRunning: boolean = false;
  private stats: ConsumerStats = {
    isRunning: false,
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    lastProcessedAt: null,
    averageProcessingTime: 0
  };
  private processingTimes: number[] = [];
  private readonly config: ConsumerConfig = {
    queueName: 'message_sending_queue',
    prefetch: 10,
    autoAck: false,
    retryAttempts: 3,
    retryDelay: 5000
  };
  private constructor() {
    super();
  }
  public static getInstance(): MessageSubscriber {
    if (!MessageSubscriber.instance) {
      MessageSubscriber.instance = new MessageSubscriber();
    }
    return MessageSubscriber.instance;
  }
  public async start(): Promise<void> {
    if (this.isRunning) {
      Logger.warn('[MESSAGE_SUBSCRIBER] Consumer already running', {
        category: 'message-consumer'
      });
      return;
    }
    try {
      Logger.info('[MESSAGE_SUBSCRIBER] Starting message consumer', {
        queueName: this.config.queueName,
        prefetch: this.config.prefetch,
        category: 'message-consumer'
      });
      if (!rabbitmqConfig.isConnectionActive()) {
        await rabbitmqConfig.connect();
      }
      const channel = rabbitmqConfig.getChannel();
      await channel.prefetch(this.config.prefetch);
      await channel.consume(
        this.config.queueName,
        async (message) => {
          if (message) {
            await this.handleMessage(message, channel);
          }
        },
        {
          noAck: this.config.autoAck
        }
      );
      this.isRunning = true;
      this.stats.isRunning = true;
      this.emit(CONSUMER_EVENTS.CONSUMER_STARTED);
      Logger.info('[MESSAGE_SUBSCRIBER] Message consumer started successfully', {
        queueName: this.config.queueName,
        category: 'message-consumer'
      });
    } catch (error) {
      Logger.error('[MESSAGE_SUBSCRIBER] Failed to start message consumer', error as Error, {
        category: 'message-consumer'
      });
      this.emit(CONSUMER_EVENTS.CONSUMER_ERROR, error);
      throw error;
    }
  }
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      Logger.warn('[MESSAGE_SUBSCRIBER] Consumer not running', {
        category: 'message-consumer'
      });
      return;
    }
    try {
      this.isRunning = false;
      this.stats.isRunning = false;
      this.emit(CONSUMER_EVENTS.CONSUMER_STOPPED);
      Logger.info('[MESSAGE_SUBSCRIBER] Message consumer stopped', {
        category: 'message-consumer'
      });
    } catch (error) {
      Logger.error('[MESSAGE_SUBSCRIBER] Error stopping message consumer', error as Error, {
        category: 'message-consumer'
      });
      throw error;
    }
  }
  private async handleMessage(message: amqp.ConsumeMessage, channel: amqp.Channel): Promise<void> {
    const startTime = Date.now();
    let queueMessage: QueueMessageData | null = null;
    try {
      const messageContent = message.content.toString();
      queueMessage = JSON.parse(messageContent) as QueueMessageData;
      Logger.debug('[MESSAGE_SUBSCRIBER] Processing message', {
        autoMessageId: queueMessage.autoMessageId,
        category: 'message-consumer'
      });
      const result = await messageConsumerService.processQueueMessage(queueMessage);
      if (result.success) {
        await this.sendNotificationIfOnline(queueMessage, result);
        channel.ack(message);
        this.updateSuccessStats(startTime);
        this.emit(CONSUMER_EVENTS.MESSAGE_PROCESSED, {
          autoMessageId: queueMessage.autoMessageId,
          messageId: result.messageId,
          conversationId: result.conversationId
        });
        Logger.info('[MESSAGE_SUBSCRIBER] Message processed successfully', {
          autoMessageId: queueMessage.autoMessageId,
          messageId: result.messageId,
          processingTime: Date.now() - startTime,
          category: 'message-consumer'
        });
      } else {
        await this.handleProcessingFailure(message, channel, queueMessage, result.error || 'Unknown error');
      }
    } catch (error) {
      Logger.error('[MESSAGE_SUBSCRIBER] Error handling message', error as Error, {
        autoMessageId: queueMessage?.autoMessageId,
        category: 'message-consumer'
      });
      await this.handleProcessingFailure(
        message,
        channel,
        queueMessage,
        (error as Error).message
      );
    }
  }
  private async sendNotificationIfOnline(
    queueMessage: QueueMessageData,
    result: { messageId?: string; conversationId?: string }
  ): Promise<void> {
    try {
      const isOnline = await userStatusService.isUserOnline(queueMessage.receiverId);
      if (!isOnline) {
        Logger.debug('[MESSAGE_SUBSCRIBER] Receiver is offline, skipping notification', {
          receiverId: queueMessage.receiverId,
          category: 'message-consumer'
        });
        return;
      }
      const Message = require('../models/message.model').default;
      const message = await Message.findById(result.messageId).populate('senderId', 'username email');
      if (!message) {
        Logger.warn('[MESSAGE_SUBSCRIBER] Message not found for notification', {
          messageId: result.messageId,
          category: 'message-consumer'
        });
        return;
      }
      const notificationData = messageConsumerService.createNotificationData(message);
      socketService.emitToUser(queueMessage.receiverId, 'message_received', notificationData);
      Logger.info('[MESSAGE_SUBSCRIBER] Notification sent to online receiver', {
        receiverId: queueMessage.receiverId,
        messageId: result.messageId,
        category: 'message-consumer'
      });
    } catch (error) {
      Logger.error('[MESSAGE_SUBSCRIBER] Failed to send notification', error as Error, {
        receiverId: queueMessage.receiverId,
        messageId: result.messageId,
        category: 'message-consumer'
      });
    }
  }
  private async handleProcessingFailure(
    message: amqp.ConsumeMessage,
    channel: amqp.Channel,
    queueMessage: QueueMessageData | null,
    error: string
  ): Promise<void> {
    try {
      const retryCount = (message.properties.headers?.['x-retry-count'] as number) || 0;
      if (retryCount < this.config.retryAttempts) {
        Logger.info('[MESSAGE_SUBSCRIBER] Retrying message processing', {
          autoMessageId: queueMessage?.autoMessageId,
          retryCount: retryCount + 1,
          maxRetries: this.config.retryAttempts,
          category: 'message-consumer'
        });
        setTimeout(async () => {
          try {
            const newHeaders = {
              ...message.properties.headers,
              'x-retry-count': retryCount + 1
            };
            await channel.publish(
              '',
              this.config.queueName,
              message.content,
              {
                ...message.properties,
                headers: newHeaders
              }
            );
            channel.ack(message);
          } catch (retryError) {
            Logger.error('[MESSAGE_SUBSCRIBER] Failed to retry message', retryError as Error, {
              autoMessageId: queueMessage?.autoMessageId,
              category: 'message-consumer'
            });
            channel.nack(message, false, false);
          }
        }, this.config.retryDelay);
      } else {
        Logger.error('[MESSAGE_SUBSCRIBER] Max retries reached, rejecting message', new Error(error), {
          autoMessageId: queueMessage?.autoMessageId,
          retryCount,
          category: 'message-consumer'
        });
        channel.nack(message, false, false); 
        this.emit(CONSUMER_EVENTS.MESSAGE_FAILED, {
          autoMessageId: queueMessage?.autoMessageId,
          error,
          retryCount
        });
      }
      this.updateFailureStats();
    } catch (error) {
      Logger.error('[MESSAGE_SUBSCRIBER] Error in failure handling', error as Error, {
        autoMessageId: queueMessage?.autoMessageId,
        category: 'message-consumer'
      });
      channel.nack(message, false, false);
    }
  }
  private updateSuccessStats(startTime: number): void {
    const processingTime = Date.now() - startTime;
    this.stats.totalProcessed++;
    this.stats.totalSuccessful++;
    this.stats.lastProcessedAt = new Date();
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift(); 
    }
    this.stats.averageProcessingTime = 
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
  }
  private updateFailureStats(): void {
    this.stats.totalProcessed++;
    this.stats.totalFailed++;
  }
  public getStats(): ConsumerStats {
    return { ...this.stats };
  }
  public resetStats(): void {
    this.stats = {
      isRunning: this.isRunning,
      totalProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      lastProcessedAt: null,
      averageProcessingTime: 0
    };
    this.processingTimes = [];
    Logger.info('[MESSAGE_SUBSCRIBER] Consumer statistics reset', {
      category: 'message-consumer'
    });
  }
  public isConsumerRunning(): boolean {
    return this.isRunning;
  }
}
export const messageSubscriber = MessageSubscriber.getInstance();
