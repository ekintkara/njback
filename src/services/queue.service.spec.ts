import { QueueService } from './queue.service';
import AutoMessage from '../models/auto-message.model';
import { rabbitmqConfig } from '../config/rabbitmq';
jest.mock('../models/auto-message.model');
jest.mock('../config/rabbitmq');
jest.mock('../utils/logger');
const mockAutoMessage = AutoMessage as jest.Mocked<typeof AutoMessage>;
const mockRabbitmqConfig = rabbitmqConfig as jest.Mocked<typeof rabbitmqConfig>;
describe('QueueService', () => {
  let queueService: QueueService;
  beforeEach(() => {
    queueService = QueueService.getInstance();
    jest.clearAllMocks();
  });
  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = QueueService.getInstance();
      const instance2 = QueueService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
  describe('processPendingMessages', () => {
    it('should process pending messages successfully', async () => {
      const mockPendingMessages = [
        {
          _id: 'msg1',
          senderId: 'user1',
          receiverId: 'user2',
          content: 'Test message 1',
          sendDate: new Date(),
          isQueued: false,
          isSent: false
        },
        {
          _id: 'msg2',
          senderId: 'user2',
          receiverId: 'user3',
          content: 'Test message 2',
          sendDate: new Date(),
          isQueued: false,
          isSent: false
        }
      ];
      mockAutoMessage.findPendingMessages.mockResolvedValue(mockPendingMessages as any);
      mockRabbitmqConfig.isConnectionActive.mockReturnValue(true);
      mockRabbitmqConfig.sendToQueue.mockResolvedValue(true);
      mockAutoMessage.markAsQueued.mockResolvedValue({} as any);
      const result = await queueService.processPendingMessages();
      expect(result.processed).toBe(2);
      expect(result.queued).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockAutoMessage.findPendingMessages).toHaveBeenCalledWith(expect.any(Date));
      expect(mockRabbitmqConfig.sendToQueue).toHaveBeenCalledTimes(2);
      expect(mockAutoMessage.markAsQueued).toHaveBeenCalledWith(['msg1', 'msg2']);
    });
    it('should return early when no pending messages found', async () => {
      mockAutoMessage.findPendingMessages.mockResolvedValue([]);
      const result = await queueService.processPendingMessages();
      expect(result.processed).toBe(0);
      expect(result.queued).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockRabbitmqConfig.sendToQueue).not.toHaveBeenCalled();
    });
    it('should establish RabbitMQ connection if not active', async () => {
      const mockPendingMessages = [
        {
          _id: 'msg1',
          senderId: 'user1',
          receiverId: 'user2',
          content: 'Test message',
          sendDate: new Date(),
          isQueued: false,
          isSent: false
        }
      ];
      mockAutoMessage.findPendingMessages.mockResolvedValue(mockPendingMessages as any);
      mockRabbitmqConfig.isConnectionActive.mockReturnValue(false);
      mockRabbitmqConfig.connect.mockResolvedValue();
      mockRabbitmqConfig.sendToQueue.mockResolvedValue(true);
      mockAutoMessage.markAsQueued.mockResolvedValue({} as any);
      await queueService.processPendingMessages();
      expect(mockRabbitmqConfig.connect).toHaveBeenCalled();
    });
    it('should handle queue sending errors gracefully', async () => {
      const mockPendingMessages = [
        {
          _id: 'msg1',
          senderId: 'user1',
          receiverId: 'user2',
          content: 'Test message',
          sendDate: new Date(),
          isQueued: false,
          isSent: false
        }
      ];
      mockAutoMessage.findPendingMessages.mockResolvedValue(mockPendingMessages as any);
      mockRabbitmqConfig.isConnectionActive.mockReturnValue(true);
      mockRabbitmqConfig.sendToQueue.mockRejectedValue(new Error('Queue error'));
      const result = await queueService.processPendingMessages();
      expect(result.processed).toBe(1);
      expect(result.queued).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(mockAutoMessage.markAsQueued).not.toHaveBeenCalled();
    });
    it('should process messages in batches', async () => {
      const mockPendingMessages = Array.from({ length: 75 }, (_, i) => ({
        _id: `msg${i}`,
        senderId: `user${i}`,
        receiverId: `user${i + 1}`,
        content: `Test message ${i}`,
        sendDate: new Date(),
        isQueued: false,
        isSent: false
      }));
      mockAutoMessage.findPendingMessages.mockResolvedValue(mockPendingMessages as any);
      mockRabbitmqConfig.isConnectionActive.mockReturnValue(true);
      mockRabbitmqConfig.sendToQueue.mockResolvedValue(true);
      mockAutoMessage.markAsQueued.mockResolvedValue({} as any);
      const result = await queueService.processPendingMessages();
      expect(result.processed).toBe(75);
      expect(result.queued).toBe(75);
      expect(mockRabbitmqConfig.sendToQueue).toHaveBeenCalledTimes(75);
      expect(mockAutoMessage.markAsQueued).toHaveBeenCalledTimes(2); 
    });
  });
  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      mockAutoMessage.countDocuments
        .mockResolvedValueOnce(5) 
        .mockResolvedValueOnce(3) 
        .mockResolvedValueOnce(10); 
      const stats = await queueService.getQueueStats();
      expect(stats).toEqual({
        pendingCount: 5,
        queuedCount: 3,
        sentCount: 10
      });
    });
    it('should handle database errors', async () => {
      mockAutoMessage.countDocuments.mockRejectedValue(new Error('DB error'));
      await expect(queueService.getQueueStats()).rejects.toThrow('DB error');
    });
  });
});
