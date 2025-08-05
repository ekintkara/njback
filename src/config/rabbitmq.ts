import * as amqp from 'amqplib';
import { config } from './env';
import Logger from '../utils/logger';
export interface QueueConfig {
  queueName: string;
  durable: boolean;
  persistent: boolean;
  prefetch: number;
}
export interface QueueMessageData {
  autoMessageId: string;
  senderId: string;
  receiverId: string;
  content: string;
  originalSendDate: string;
  queuedAt: string;
}
export class RabbitMQConfig {
  private static instance: RabbitMQConfig;
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private isConnected: boolean = false;
  public static readonly QUEUES = {
    MESSAGE_SENDING: 'message_sending_queue'
  } as const;
  public static readonly QUEUE_CONFIG: QueueConfig = {
    queueName: RabbitMQConfig.QUEUES.MESSAGE_SENDING,
    durable: true,
    persistent: true,
    prefetch: 10
  };
  private constructor() {}
  public static getInstance(): RabbitMQConfig {
    if (!RabbitMQConfig.instance) {
      RabbitMQConfig.instance = new RabbitMQConfig();
    }
    return RabbitMQConfig.instance;
  }
  public async connect(): Promise<void> {
    if (this.isConnected && this.connection && this.channel) {
      Logger.warn('[RABBITMQ] Already connected to RabbitMQ', {
        category: 'rabbitmq'
      });
      return;
    }
    try {
      const rabbitmqUrl = config.RABBITMQ_URL || 'amqp://localhost:5672';
      Logger.info('[RABBITMQ] Connecting to RabbitMQ', {
        url: rabbitmqUrl.replace(/\/\/.*@/, '//***:***@'), 
        category: 'rabbitmq'
      });
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      await this.channel!.prefetch(RabbitMQConfig.QUEUE_CONFIG.prefetch);
      await this.setupQueues();
      this.setupConnectionHandlers();
      this.isConnected = true;
      Logger.info('[RABBITMQ] Successfully connected to RabbitMQ', {
        category: 'rabbitmq'
      });
    } catch (error) {
      Logger.error('[RABBITMQ] Failed to connect to RabbitMQ', error as Error, {
        category: 'rabbitmq'
      });
      throw error;
    }
  }
  private async setupQueues(): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }
    try {
      await this.channel.assertQueue(RabbitMQConfig.QUEUES.MESSAGE_SENDING, {
        durable: RabbitMQConfig.QUEUE_CONFIG.durable
      });
      Logger.info('[RABBITMQ] Queues setup completed', {
        queues: [RabbitMQConfig.QUEUES.MESSAGE_SENDING],
        category: 'rabbitmq'
      });
    } catch (error) {
      Logger.error('[RABBITMQ] Failed to setup queues', error as Error, {
        category: 'rabbitmq'
      });
      throw error;
    }
  }
  private setupConnectionHandlers(): void {
    if (!this.connection) return;
    this.connection.on('error', (error) => {
      Logger.error('[RABBITMQ] Connection error', error, {
        category: 'rabbitmq'
      });
      this.isConnected = false;
    });
    this.connection.on('close', () => {
      Logger.warn('[RABBITMQ] Connection closed', {
        category: 'rabbitmq'
      });
      this.isConnected = false;
    });
  }
  public async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      this.isConnected = false;
      Logger.info('[RABBITMQ] Disconnected from RabbitMQ', {
        category: 'rabbitmq'
      });
    } catch (error) {
      Logger.error('[RABBITMQ] Error during disconnect', error as Error, {
        category: 'rabbitmq'
      });
    }
  }
  public getChannel(): amqp.Channel {
    if (!this.channel || !this.isConnected) {
      throw new Error('RabbitMQ not connected. Call connect() first.');
    }
    return this.channel;
  }
  public isConnectionActive(): boolean {
    return this.isConnected && !!this.connection && !!this.channel;
  }
  public async sendToQueue(queueName: string, message: QueueMessageData): Promise<boolean> {
    if (!this.isConnectionActive()) {
      throw new Error('RabbitMQ not connected');
    }
    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      const result = this.channel!.sendToQueue(queueName, messageBuffer, {
        persistent: RabbitMQConfig.QUEUE_CONFIG.persistent
      });
      Logger.debug('[RABBITMQ] Message sent to queue', {
        queueName,
        messageId: message.autoMessageId,
        category: 'rabbitmq'
      });
      return result;
    } catch (error) {
      Logger.error('[RABBITMQ] Failed to send message to queue', error as Error, {
        queueName,
        messageId: message.autoMessageId,
        category: 'rabbitmq'
      });
      throw error;
    }
  }
}
export const rabbitmqConfig = RabbitMQConfig.getInstance();
