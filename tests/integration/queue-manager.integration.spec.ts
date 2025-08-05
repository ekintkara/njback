import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { QueueService } from '../../src/services/queue.service';
import { QueueManagerJob } from '../../src/jobs/queue-manager.job';
import { JobManager } from '../../src/jobs/job-manager';
import { MessageConsumerService } from '../../src/services/message-consumer.service';
import User from '../../src/models/user.model';
import AutoMessage from '../../src/models/auto-message.model';
import Message from '../../src/models/message.model';
import Conversation from '../../src/models/conversation.model';
import { rabbitmqConfig } from '../../src/config/rabbitmq';
jest.mock('../../src/config/rabbitmq', () => ({
  rabbitmqConfig: {
    isConnectionActive: jest.fn().mockReturnValue(true),
    connect: jest.fn().mockResolvedValue(undefined),
    sendToQueue: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getChannel: jest.fn().mockReturnValue({
      prefetch: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue(undefined),
      ack: jest.fn(),
      nack: jest.fn()
    })
  }
}));
jest.mock('../../src/socket/socket.service', () => ({
  socketService: {
    emitToUser: jest.fn()
  }
}));
jest.mock('../../src/services/user-status.service', () => ({
  userStatusService: {
    isUserOnline: jest.fn().mockResolvedValue(false)
  }
}));
const mockRabbitmqConfig = rabbitmqConfig as jest.Mocked<typeof rabbitmqConfig>;
describe('Queue Manager Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let queueService: QueueService;
  let queueManagerJob: QueueManagerJob;
  let jobManager: JobManager;
  let messageConsumerService: MessageConsumerService;
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoUri);
  });
  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoServer.stop();
  });
  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    queueService = QueueService.getInstance();
    queueManagerJob = new QueueManagerJob();
    jobManager = new JobManager();
    messageConsumerService = MessageConsumerService.getInstance();
    jest.clearAllMocks();
  });
  afterEach(async () => {
    if (jobManager && jobManager.isJobManagerInitialized()) {
      await jobManager.shutdown();
    }
  });
  describe('End-to-End Queue Processing', () => {
    it('should process pending auto messages end-to-end', async () => {
      const users = await User.insertMany([
        { username: 'user1', email: 'user1@test.com', password: 'hashedpass', isActive: true },
        { username: 'user2', email: 'user2@test.com', password: 'hashedpass', isActive: true },
        { username: 'user3', email: 'user3@test.com', password: 'hashedpass', isActive: true }
      ]);
      const pastDate = new Date(Date.now() - 60000); 
      await AutoMessage.insertMany([
        {
          senderId: users[0]._id,
          receiverId: users[1]._id,
          content: 'Test message 1',
          sendDate: pastDate,
          isQueued: false,
          isSent: false
        },
        {
          senderId: users[1]._id,
          receiverId: users[2]._id,
          content: 'Test message 2',
          sendDate: pastDate,
          isQueued: false,
          isSent: false
        }
      ]);
      const result = await queueService.processPendingMessages();
      expect(result.processed).toBe(2);
      expect(result.queued).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockRabbitmqConfig.sendToQueue).toHaveBeenCalledTimes(2);
      const updatedMessages = await AutoMessage.find({ isQueued: true });
      expect(updatedMessages).toHaveLength(2);
    });
    it('should handle messages with future send dates', async () => {
      const users = await User.insertMany([
        { username: 'user1', email: 'user1@test.com', password: 'hashedpass', isActive: true },
        { username: 'user2', email: 'user2@test.com', password: 'hashedpass', isActive: true }
      ]);
      const futureDate = new Date(Date.now() + 60000); 
      await AutoMessage.insertMany([
        {
          senderId: users[0]._id,
          receiverId: users[1]._id,
          content: 'Future message',
          sendDate: futureDate,
          isQueued: false,
          isSent: false
        }
      ]);
      const result = await queueService.processPendingMessages();
      expect(result.processed).toBe(0);
      expect(result.queued).toBe(0);
      expect(mockRabbitmqConfig.sendToQueue).not.toHaveBeenCalled();
    });
    it('should skip already queued messages', async () => {
      const users = await User.insertMany([
        { username: 'user1', email: 'user1@test.com', password: 'hashedpass', isActive: true },
        { username: 'user2', email: 'user2@test.com', password: 'hashedpass', isActive: true }
      ]);
      const pastDate = new Date(Date.now() - 60000);
      await AutoMessage.insertMany([
        {
          senderId: users[0]._id,
          receiverId: users[1]._id,
          content: 'Pending message',
          sendDate: pastDate,
          isQueued: false,
          isSent: false
        },
        {
          senderId: users[1]._id,
          receiverId: users[0]._id,
          content: 'Already queued message',
          sendDate: pastDate,
          isQueued: true,
          isSent: false
        }
      ]);
      const result = await queueService.processPendingMessages();
      expect(result.processed).toBe(1);
      expect(result.queued).toBe(1);
      expect(mockRabbitmqConfig.sendToQueue).toHaveBeenCalledTimes(1);
    });
  });
  describe('Queue Manager Job Integration', () => {
    it('should execute queue manager job manually', async () => {
      const users = await User.insertMany([
        { username: 'user1', email: 'user1@test.com', password: 'hashedpass', isActive: true },
        { username: 'user2', email: 'user2@test.com', password: 'hashedpass', isActive: true }
      ]);
      const pastDate = new Date(Date.now() - 60000);
      await AutoMessage.insertMany([
        {
          senderId: users[0]._id,
          receiverId: users[1]._id,
          content: 'Test message',
          sendDate: pastDate,
          isQueued: false,
          isSent: false
        }
      ]);
      await queueManagerJob.executeManually();
      const status = queueManagerJob.getStatus();
      expect(status.totalProcessed).toBe(1);
      expect(status.totalQueued).toBe(1);
      expect(status.lastExecution).toBeInstanceOf(Date);
    });
    it('should get queue statistics correctly', async () => {
      const users = await User.insertMany([
        { username: 'user1', email: 'user1@test.com', password: 'hashedpass', isActive: true },
        { username: 'user2', email: 'user2@test.com', password: 'hashedpass', isActive: true }
      ]);
      const pastDate = new Date(Date.now() - 60000);
      const futureDate = new Date(Date.now() + 60000);
      await AutoMessage.insertMany([
        {
          senderId: users[0]._id,
          receiverId: users[1]._id,
          content: 'Pending',
          sendDate: pastDate,
          isQueued: false,
          isSent: false
        },
        {
          senderId: users[1]._id,
          receiverId: users[0]._id,
          content: 'Queued',
          sendDate: pastDate,
          isQueued: true,
          isSent: false
        },
        {
          senderId: users[0]._id,
          receiverId: users[1]._id,
          content: 'Sent',
          sendDate: pastDate,
          isQueued: true,
          isSent: true
        },
        {
          senderId: users[1]._id,
          receiverId: users[0]._id,
          content: 'Future',
          sendDate: futureDate,
          isQueued: false,
          isSent: false
        }
      ]);
      const stats = await queueManagerJob.getQueueStats();
      expect(stats.pendingCount).toBe(1);
      expect(stats.queuedCount).toBe(1);
      expect(stats.sentCount).toBe(1);
    });
  });
  describe('Job Manager Integration', () => {
    it('should initialize and shutdown job manager with queue manager', async () => {
      expect(jobManager.isJobManagerInitialized()).toBe(false);
      await jobManager.initialize();
      expect(jobManager.isJobManagerInitialized()).toBe(true);
      const status = jobManager.getJobsStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.queueManagerJob).toBeDefined();
      await jobManager.shutdown();
      expect(jobManager.isJobManagerInitialized()).toBe(false);
    });
    it('should trigger queue manager job manually', async () => {
      const users = await User.insertMany([
        { username: 'user1', email: 'user1@test.com', password: 'hashedpass', isActive: true },
        { username: 'user2', email: 'user2@test.com', password: 'hashedpass', isActive: true }
      ]);
      const pastDate = new Date(Date.now() - 60000);
      await AutoMessage.insertMany([
        {
          senderId: users[0]._id,
          receiverId: users[1]._id,
          content: 'Test message',
          sendDate: pastDate,
          isQueued: false,
          isSent: false
        }
      ]);
      await jobManager.initialize();
      await jobManager.triggerQueueManagerJob();
      const queuedMessages = await AutoMessage.find({ isQueued: true });
      expect(queuedMessages).toHaveLength(1);
      await jobManager.shutdown();
    });
  });
  describe('Error Handling', () => {
    it('should handle RabbitMQ connection errors gracefully', async () => {
      mockRabbitmqConfig.isConnectionActive.mockReturnValue(false);
      mockRabbitmqConfig.connect.mockRejectedValue(new Error('Connection failed'));
      const users = await User.insertMany([
        { username: 'user1', email: 'user1@test.com', password: 'hashedpass', isActive: true },
        { username: 'user2', email: 'user2@test.com', password: 'hashedpass', isActive: true }
      ]);
      const pastDate = new Date(Date.now() - 60000);
      await AutoMessage.insertMany([
        {
          senderId: users[0]._id,
          receiverId: users[1]._id,
          content: 'Test message',
          sendDate: pastDate,
          isQueued: false,
          isSent: false
        }
      ]);
      await expect(queueService.processPendingMessages()).rejects.toThrow('Connection failed');
    });
    it('should handle partial queue failures', async () => {
      const users = await User.insertMany([
        { username: 'user1', email: 'user1@test.com', password: 'hashedpass', isActive: true },
        { username: 'user2', email: 'user2@test.com', password: 'hashedpass', isActive: true }
      ]);
      const pastDate = new Date(Date.now() - 60000);
      await AutoMessage.insertMany([
        {
          senderId: users[0]._id,
          receiverId: users[1]._id,
          content: 'Message 1',
          sendDate: pastDate,
          isQueued: false,
          isSent: false
        },
        {
          senderId: users[1]._id,
          receiverId: users[0]._id,
          content: 'Message 2',
          sendDate: pastDate,
          isQueued: false,
          isSent: false
        }
      ]);
      mockRabbitmqConfig.sendToQueue
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('Queue error'));
      const result = await queueService.processPendingMessages();
      expect(result.processed).toBe(2);
      expect(result.queued).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });
  describe('Message Consumer Integration', () => {
    it('should process queue message and create database records', async () => {
      const users = await User.insertMany([
        { username: 'sender', email: 'sender@test.com', password: 'hashedpass', isActive: true },
        { username: 'receiver', email: 'receiver@test.com', password: 'hashedpass', isActive: true }
      ]);
      const queueMessage = {
        autoMessageId: new mongoose.Types.ObjectId().toString(),
        senderId: users[0]._id.toString(),
        receiverId: users[1]._id.toString(),
        content: 'Test auto message',
        originalSendDate: new Date().toISOString(),
        queuedAt: new Date().toISOString()
      };
      const autoMessage = new AutoMessage({
        _id: queueMessage.autoMessageId,
        senderId: users[0]._id,
        receiverId: users[1]._id,
        content: queueMessage.content,
        sendDate: new Date(),
        isQueued: true,
        isSent: false
      });
      await autoMessage.save();
      const result = await messageConsumerService.processQueueMessage(queueMessage);
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.conversationId).toBeDefined();
      const message = await Message.findById(result.messageId);
      expect(message).toBeTruthy();
      expect(message!.content).toBe(queueMessage.content);
      expect(message!.senderId.toString()).toBe(users[0]._id.toString());
      const conversation = await Conversation.findById(result.conversationId);
      expect(conversation).toBeTruthy();
      expect(conversation!.participants).toHaveLength(2);
      const updatedAutoMessage = await AutoMessage.findById(queueMessage.autoMessageId);
      expect(updatedAutoMessage!.isSent).toBe(true);
    });
    it('should handle invalid queue message data', async () => {
      const invalidQueueMessage = {
        autoMessageId: 'invalid-id',
        senderId: 'invalid-sender',
        receiverId: 'invalid-receiver',
        content: '',
        originalSendDate: new Date().toISOString(),
        queuedAt: new Date().toISOString()
      };
      const result = await messageConsumerService.processQueueMessage(invalidQueueMessage);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
