import { MessageSubscriber } from './message.subscriber';
import { messageConsumerService } from '../services/message-consumer.service';
import { rabbitmqConfig } from '../config/rabbitmq';
import { socketService } from '../socket/socket.service';
import { userStatusService } from '../services/user-status.service';
jest.mock('../services/message-consumer.service');
jest.mock('../config/rabbitmq');
jest.mock('../socket/socket.service');
jest.mock('../services/user-status.service');
jest.mock('../utils/logger');
jest.mock('amqplib');
const mockMessageConsumerService = messageConsumerService as jest.Mocked<typeof messageConsumerService>;
const mockRabbitmqConfig = rabbitmqConfig as jest.Mocked<typeof rabbitmqConfig>;
const mockSocketService = socketService as jest.Mocked<typeof socketService>;
const mockUserStatusService = userStatusService as jest.Mocked<typeof userStatusService>;
describe('MessageSubscriber', () => {
  let messageSubscriber: MessageSubscriber;
  let mockChannel: any;
  beforeEach(() => {
    messageSubscriber = MessageSubscriber.getInstance();
    mockChannel = {
      prefetch: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue(undefined),
      ack: jest.fn(),
      nack: jest.fn(),
      publish: jest.fn().mockResolvedValue(true)
    };
    mockRabbitmqConfig.getChannel.mockReturnValue(mockChannel);
    mockRabbitmqConfig.isConnectionActive.mockReturnValue(true);
    jest.clearAllMocks();
  });
  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = MessageSubscriber.getInstance();
      const instance2 = MessageSubscriber.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
  describe('start', () => {
    it('should start consumer successfully', async () => {
      await messageSubscriber.start();
      expect(mockRabbitmqConfig.getChannel).toHaveBeenCalled();
      expect(mockChannel.prefetch).toHaveBeenCalledWith(10);
      expect(mockChannel.consume).toHaveBeenCalledWith(
        'message_sending_queue',
        expect.any(Function),
        { noAck: false }
      );
      expect(messageSubscriber.isConsumerRunning()).toBe(true);
    });
    it('should establish RabbitMQ connection if not active', async () => {
      mockRabbitmqConfig.isConnectionActive.mockReturnValue(false);
      mockRabbitmqConfig.connect.mockResolvedValue();
      await messageSubscriber.start();
      expect(mockRabbitmqConfig.connect).toHaveBeenCalled();
    });
    it('should not start if already running', async () => {
      await messageSubscriber.start();
      await messageSubscriber.start(); 
      expect(mockChannel.consume).toHaveBeenCalledTimes(1);
    });
    it('should handle connection errors', async () => {
      mockRabbitmqConfig.isConnectionActive.mockReturnValue(false);
      mockRabbitmqConfig.connect.mockRejectedValue(new Error('Connection failed'));
      await expect(messageSubscriber.start()).rejects.toThrow('Connection failed');
    });
  });
  describe('stop', () => {
    it('should stop consumer successfully', async () => {
      await messageSubscriber.start();
      await messageSubscriber.stop();
      expect(messageSubscriber.isConsumerRunning()).toBe(false);
    });
    it('should not stop if not running', async () => {
      await messageSubscriber.stop();
      expect(messageSubscriber.isConsumerRunning()).toBe(false);
    });
  });
  describe('message processing', () => {
    beforeEach(async () => {
      await messageSubscriber.start();
    });
    it('should process message successfully and send notification', async () => {
      const mockMessage = {
        content: Buffer.from(JSON.stringify({
          autoMessageId: '507f1f77bcf86cd799439011',
          senderId: '507f1f77bcf86cd799439012',
          receiverId: '507f1f77bcf86cd799439013',
          content: 'Test message',
          originalSendDate: new Date().toISOString(),
          queuedAt: new Date().toISOString()
        })),
        properties: { headers: {} }
      };
      mockMessageConsumerService.processQueueMessage.mockResolvedValue({
        success: true,
        messageId: 'msg123',
        conversationId: 'conv123'
      });
      mockUserStatusService.isUserOnline.mockResolvedValue(true);
      const Message = require('../models/message.model');
      const mockMessageDoc = {
        _id: 'msg123',
        senderId: {
          _id: '507f1f77bcf86cd799439012',
          username: 'testuser',
          email: 'test@example.com'
        },
        content: 'Test message',
        createdAt: new Date()
      };
      Message.default = {
        findById: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockMessageDoc)
        })
      };
      mockMessageConsumerService.createNotificationData.mockReturnValue({
        messageId: 'msg123',
        conversationId: 'conv123',
        senderId: '507f1f77bcf86cd799439012',
        senderInfo: {
          _id: '507f1f77bcf86cd799439012',
          username: 'testuser',
          email: 'test@example.com'
        },
        content: 'Test message',
        createdAt: new Date().toISOString(),
        isAutoMessage: true
      });
      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      await consumeCallback(mockMessage);
      expect(mockMessageConsumerService.processQueueMessage).toHaveBeenCalled();
      expect(mockUserStatusService.isUserOnline).toHaveBeenCalledWith('507f1f77bcf86cd799439013');
      expect(mockSocketService.emitToUser).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439013',
        'message_received',
        expect.any(Object)
      );
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });
    it('should skip notification if receiver is offline', async () => {
      const mockMessage = {
        content: Buffer.from(JSON.stringify({
          autoMessageId: '507f1f77bcf86cd799439011',
          senderId: '507f1f77bcf86cd799439012',
          receiverId: '507f1f77bcf86cd799439013',
          content: 'Test message',
          originalSendDate: new Date().toISOString(),
          queuedAt: new Date().toISOString()
        })),
        properties: { headers: {} }
      };
      mockMessageConsumerService.processQueueMessage.mockResolvedValue({
        success: true,
        messageId: 'msg123',
        conversationId: 'conv123'
      });
      mockUserStatusService.isUserOnline.mockResolvedValue(false);
      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      await consumeCallback(mockMessage);
      expect(mockSocketService.emitToUser).not.toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
    });
    it('should handle processing failure with retry', async () => {
      const mockMessage = {
        content: Buffer.from(JSON.stringify({
          autoMessageId: '507f1f77bcf86cd799439011',
          senderId: '507f1f77bcf86cd799439012',
          receiverId: '507f1f77bcf86cd799439013',
          content: 'Test message',
          originalSendDate: new Date().toISOString(),
          queuedAt: new Date().toISOString()
        })),
        properties: { headers: {} }
      };
      mockMessageConsumerService.processQueueMessage.mockResolvedValue({
        success: false,
        error: 'Processing failed'
      });
      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      jest.useFakeTimers();
      const callbackPromise = consumeCallback(mockMessage);
      jest.advanceTimersByTime(5000);
      await callbackPromise;
      expect(mockChannel.publish).toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMessage);
      jest.useRealTimers();
    });
    it('should reject message after max retries', async () => {
      const mockMessage = {
        content: Buffer.from(JSON.stringify({
          autoMessageId: '507f1f77bcf86cd799439011',
          senderId: '507f1f77bcf86cd799439012',
          receiverId: '507f1f77bcf86cd799439013',
          content: 'Test message',
          originalSendDate: new Date().toISOString(),
          queuedAt: new Date().toISOString()
        })),
        properties: { 
          headers: { 'x-retry-count': 3 } 
        }
      };
      mockMessageConsumerService.processQueueMessage.mockResolvedValue({
        success: false,
        error: 'Processing failed'
      });
      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      await consumeCallback(mockMessage);
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
    });
    it('should handle invalid JSON in message', async () => {
      const mockMessage = {
        content: Buffer.from('invalid json'),
        properties: { headers: {} }
      };
      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      await consumeCallback(mockMessage);
      expect(mockChannel.nack).toHaveBeenCalledWith(mockMessage, false, false);
    });
  });
  describe('getStats', () => {
    it('should return correct initial stats', () => {
      const stats = messageSubscriber.getStats();
      expect(stats).toEqual({
        isRunning: false,
        totalProcessed: 0,
        totalSuccessful: 0,
        totalFailed: 0,
        lastProcessedAt: null,
        averageProcessingTime: 0
      });
    });
    it('should update stats after successful processing', async () => {
      await messageSubscriber.start();
      const mockMessage = {
        content: Buffer.from(JSON.stringify({
          autoMessageId: '507f1f77bcf86cd799439011',
          senderId: '507f1f77bcf86cd799439012',
          receiverId: '507f1f77bcf86cd799439013',
          content: 'Test message',
          originalSendDate: new Date().toISOString(),
          queuedAt: new Date().toISOString()
        })),
        properties: { headers: {} }
      };
      mockMessageConsumerService.processQueueMessage.mockResolvedValue({
        success: true,
        messageId: 'msg123',
        conversationId: 'conv123'
      });
      mockUserStatusService.isUserOnline.mockResolvedValue(false);
      const consumeCallback = mockChannel.consume.mock.calls[0][1];
      await consumeCallback(mockMessage);
      const stats = messageSubscriber.getStats();
      expect(stats.totalProcessed).toBe(1);
      expect(stats.totalSuccessful).toBe(1);
      expect(stats.totalFailed).toBe(0);
      expect(stats.lastProcessedAt).toBeInstanceOf(Date);
    });
  });
  describe('resetStats', () => {
    it('should reset all statistics', () => {
      messageSubscriber.resetStats();
      const stats = messageSubscriber.getStats();
      expect(stats.totalProcessed).toBe(0);
      expect(stats.totalSuccessful).toBe(0);
      expect(stats.totalFailed).toBe(0);
      expect(stats.lastProcessedAt).toBeNull();
      expect(stats.averageProcessingTime).toBe(0);
    });
  });
});
