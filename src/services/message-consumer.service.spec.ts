import { MessageConsumerService } from './message-consumer.service';
import Message from '../models/message.model';
import Conversation from '../models/conversation.model';
import AutoMessage from '../models/auto-message.model';
import User from '../models/user.model';
import { QueueMessageData } from '../types/queue.types';
jest.mock('../models/message.model');
jest.mock('../models/conversation.model');
jest.mock('../models/auto-message.model');
jest.mock('../models/user.model');
jest.mock('../utils/logger');
const mockMessage = Message as jest.Mocked<typeof Message>;
const mockConversation = Conversation as jest.Mocked<typeof Conversation>;
const mockAutoMessage = AutoMessage as jest.Mocked<typeof AutoMessage>;
const mockUser = User as jest.Mocked<typeof User>;
describe('MessageConsumerService', () => {
  let messageConsumerService: MessageConsumerService;
  beforeEach(() => {
    messageConsumerService = MessageConsumerService.getInstance();
    jest.clearAllMocks();
  });
  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = MessageConsumerService.getInstance();
      const instance2 = MessageConsumerService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
  describe('processQueueMessage', () => {
    const validQueueMessage: QueueMessageData = {
      autoMessageId: '507f1f77bcf86cd799439011',
      senderId: '507f1f77bcf86cd799439012',
      receiverId: '507f1f77bcf86cd799439013',
      content: 'Test message content',
      originalSendDate: new Date().toISOString(),
      queuedAt: new Date().toISOString()
    };
    it('should process queue message successfully', async () => {
      const mockSender = { _id: validQueueMessage.senderId, isActive: true };
      const mockReceiver = { _id: validQueueMessage.receiverId, isActive: true };
      mockUser.findById
        .mockResolvedValueOnce(mockSender as any)
        .mockResolvedValueOnce(mockReceiver as any);
      const mockConversationDoc = { _id: 'conv123' };
      mockConversation.findOne.mockResolvedValue(mockConversationDoc as any);
      const mockMessageDoc = {
        _id: 'msg123',
        conversationId: 'conv123',
        senderId: validQueueMessage.senderId,
        content: validQueueMessage.content,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(true)
      };
      (mockMessage as any).mockImplementation(() => mockMessageDoc);
      mockAutoMessage.markAsSent.mockResolvedValue({} as any);
      const result = await messageConsumerService.processQueueMessage(validQueueMessage);
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg123');
      expect(result.conversationId).toBe('conv123');
      expect(mockUser.findById).toHaveBeenCalledTimes(2);
      expect(mockConversation.findOne).toHaveBeenCalled();
      expect(mockAutoMessage.markAsSent).toHaveBeenCalled();
    });
    it('should create new conversation if not exists', async () => {
      const mockSender = { _id: validQueueMessage.senderId, isActive: true };
      const mockReceiver = { _id: validQueueMessage.receiverId, isActive: true };
      mockUser.findById
        .mockResolvedValueOnce(mockSender as any)
        .mockResolvedValueOnce(mockReceiver as any);
      mockConversation.findOne.mockResolvedValue(null);
      const mockNewConversation = {
        _id: 'newconv123',
        save: jest.fn().mockResolvedValue(true)
      };
      (mockConversation as any).mockImplementation(() => mockNewConversation);
      const mockMessageDoc = {
        _id: 'msg123',
        conversationId: 'newconv123',
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(true)
      };
      (mockMessage as any).mockImplementation(() => mockMessageDoc);
      mockAutoMessage.markAsSent.mockResolvedValue({} as any);
      const result = await messageConsumerService.processQueueMessage(validQueueMessage);
      expect(result.success).toBe(true);
      expect(result.conversationId).toBe('newconv123');
      expect(mockNewConversation.save).toHaveBeenCalled();
    });
    it('should handle invalid autoMessageId', async () => {
      const invalidMessage = {
        ...validQueueMessage,
        autoMessageId: 'invalid-id'
      };
      const result = await messageConsumerService.processQueueMessage(invalidMessage);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid autoMessageId');
    });
    it('should handle invalid senderId', async () => {
      const invalidMessage = {
        ...validQueueMessage,
        senderId: 'invalid-id'
      };
      const result = await messageConsumerService.processQueueMessage(invalidMessage);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid senderId');
    });
    it('should handle invalid receiverId', async () => {
      const invalidMessage = {
        ...validQueueMessage,
        receiverId: 'invalid-id'
      };
      const result = await messageConsumerService.processQueueMessage(invalidMessage);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid receiverId');
    });
    it('should handle empty content', async () => {
      const invalidMessage = {
        ...validQueueMessage,
        content: ''
      };
      const result = await messageConsumerService.processQueueMessage(invalidMessage);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Message content is required');
    });
    it('should handle content too long', async () => {
      const invalidMessage = {
        ...validQueueMessage,
        content: 'a'.repeat(1001)
      };
      const result = await messageConsumerService.processQueueMessage(invalidMessage);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Message content too long');
    });
    it('should handle same sender and receiver', async () => {
      const invalidMessage = {
        ...validQueueMessage,
        receiverId: validQueueMessage.senderId
      };
      const result = await messageConsumerService.processQueueMessage(invalidMessage);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Sender and receiver cannot be the same');
    });
    it('should handle sender not found', async () => {
      mockUser.findById
        .mockResolvedValueOnce(null) 
        .mockResolvedValueOnce({ _id: validQueueMessage.receiverId, isActive: true } as any);
      const result = await messageConsumerService.processQueueMessage(validQueueMessage);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Sender user not found');
    });
    it('should handle receiver not found', async () => {
      mockUser.findById
        .mockResolvedValueOnce({ _id: validQueueMessage.senderId, isActive: true } as any)
        .mockResolvedValueOnce(null); 
      const result = await messageConsumerService.processQueueMessage(validQueueMessage);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Receiver user not found');
    });
    it('should handle inactive sender', async () => {
      mockUser.findById
        .mockResolvedValueOnce({ _id: validQueueMessage.senderId, isActive: false } as any)
        .mockResolvedValueOnce({ _id: validQueueMessage.receiverId, isActive: true } as any);
      const result = await messageConsumerService.processQueueMessage(validQueueMessage);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Sender user is not active');
    });
    it('should handle inactive receiver', async () => {
      mockUser.findById
        .mockResolvedValueOnce({ _id: validQueueMessage.senderId, isActive: true } as any)
        .mockResolvedValueOnce({ _id: validQueueMessage.receiverId, isActive: false } as any);
      const result = await messageConsumerService.processQueueMessage(validQueueMessage);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Receiver user is not active');
    });
    it('should handle database errors gracefully', async () => {
      mockUser.findById.mockRejectedValue(new Error('Database error'));
      const result = await messageConsumerService.processQueueMessage(validQueueMessage);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });
  describe('createNotificationData', () => {
    it('should create correct notification data', () => {
      const mockMessage = {
        _id: 'msg123',
        conversationId: 'conv123',
        senderId: {
          _id: 'user123',
          username: 'testuser',
          email: 'test@example.com'
        },
        content: 'Test message',
        createdAt: new Date('2023-01-01T00:00:00.000Z')
      };
      const notificationData = messageConsumerService.createNotificationData(mockMessage);
      expect(notificationData).toEqual({
        messageId: 'msg123',
        conversationId: 'conv123',
        senderId: 'user123',
        senderInfo: {
          _id: 'user123',
          username: 'testuser',
          email: 'test@example.com'
        },
        content: 'Test message',
        createdAt: '2023-01-01T00:00:00.000Z',
        isAutoMessage: true
      });
    });
  });
});
