import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { AutoMessageService } from '../../src/services/auto-message.service';
import { MessagePlanningJob } from '../../src/jobs/message-planning.job';
import { JobManager } from '../../src/jobs/job-manager';
import User from '../../src/models/user.model';
import AutoMessage from '../../src/models/auto-message.model';
describe('Auto Message Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let autoMessageService: AutoMessageService;
  let messagePlanningJob: MessagePlanningJob;
  let jobManager: JobManager;
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoUri);
    autoMessageService = new AutoMessageService();
    messagePlanningJob = new MessagePlanningJob();
    jobManager = new JobManager();
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  beforeEach(async () => {
    await User.deleteMany({});
    await AutoMessage.deleteMany({});
    await User.create([
      {
        username: 'user1',
        email: 'user1@example.com',
        password: 'hashedpassword1',
        isActive: true
      },
      {
        username: 'user2',
        email: 'user2@example.com',
        password: 'hashedpassword2',
        isActive: true
      },
      {
        username: 'user3',
        email: 'user3@example.com',
        password: 'hashedpassword3',
        isActive: true
      },
      {
        username: 'user4',
        email: 'user4@example.com',
        password: 'hashedpassword4',
        isActive: true
      },
      {
        username: 'inactiveuser',
        email: 'inactive@example.com',
        password: 'hashedpassword',
        isActive: false
      }
    ]);
  });
  afterEach(async () => {
    if (jobManager && jobManager.isJobManagerInitialized()) {
      await jobManager.shutdown();
    }
  });
  describe('End-to-End Message Planning', () => {
    it('should plan messages for active users end-to-end', async () => {
      const messagesPlanned = await autoMessageService.planAutomaticMessages();
      expect(messagesPlanned).toBe(2);
      const autoMessages = await AutoMessage.find({})
        .populate('senderId', 'username email')
        .populate('receiverId', 'username email');
      expect(autoMessages).toHaveLength(2);
      autoMessages.forEach(message => {
        expect(message.senderId).toBeDefined();
        expect(message.receiverId).toBeDefined();
        expect(message.content).toBeTruthy();
        expect(message.sendDate).toBeInstanceOf(Date);
        expect(message.sendDate.getTime()).toBeGreaterThan(Date.now());
        expect(message.isQueued).toBe(false);
        expect(message.isSent).toBe(false);
        expect((message.senderId as any).username).toBeTruthy();
        expect((message.senderId as any).email).toBeTruthy();
        expect((message.receiverId as any).username).toBeTruthy();
        expect((message.receiverId as any).email).toBeTruthy();
        expect(message.senderId._id.toString()).not.toBe(message.receiverId._id.toString());
      });
    });
    it('should handle insufficient active users', async () => {
      await User.updateMany({ username: { $ne: 'user1' } }, { isActive: false });
      const messagesPlanned = await autoMessageService.planAutomaticMessages();
      expect(messagesPlanned).toBe(0);
      const autoMessages = await AutoMessage.find({});
      expect(autoMessages).toHaveLength(0);
    });
    it('should handle odd number of active users', async () => {
      await User.updateOne({ username: 'user4' }, { isActive: false });
      const messagesPlanned = await autoMessageService.planAutomaticMessages();
      expect(messagesPlanned).toBe(1);
      const autoMessages = await AutoMessage.find({});
      expect(autoMessages).toHaveLength(1);
    });
  });
  describe('Message Planning Job Integration', () => {
    it('should execute message planning job manually', async () => {
      await messagePlanningJob.executeManually();
      const autoMessages = await AutoMessage.find({});
      expect(autoMessages.length).toBeGreaterThan(0);
    });
    it('should get job status correctly', () => {
      const status = messagePlanningJob.getStatus();
      expect(status).toHaveProperty('isScheduled');
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('nextExecution');
      expect(typeof status.isScheduled).toBe('boolean');
      expect(typeof status.isRunning).toBe('boolean');
    });
    it('should start and stop job correctly', () => {
      messagePlanningJob.start();
      let status = messagePlanningJob.getStatus();
      expect(status.isScheduled).toBe(true);
      messagePlanningJob.stop();
      status = messagePlanningJob.getStatus();
      expect(status.isScheduled).toBe(false);
    });
  });
  describe('Job Manager Integration', () => {
    it('should initialize and shutdown job manager', async () => {
      expect(jobManager.isJobManagerInitialized()).toBe(false);
      await jobManager.initialize();
      expect(jobManager.isJobManagerInitialized()).toBe(true);
      const status = jobManager.getJobsStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.messagePlanningJob.isScheduled).toBe(true);
      await jobManager.shutdown();
      expect(jobManager.isJobManagerInitialized()).toBe(false);
    });
    it('should trigger message planning job manually', async () => {
      await jobManager.initialize();
      await jobManager.triggerMessagePlanningJob();
      const autoMessages = await AutoMessage.find({});
      expect(autoMessages.length).toBeGreaterThan(0);
      await jobManager.shutdown();
    });
    it('should handle multiple initialization attempts', async () => {
      await jobManager.initialize();
      await expect(jobManager.initialize()).resolves.not.toThrow();
      expect(jobManager.isJobManagerInitialized()).toBe(true);
      await jobManager.shutdown();
    });
    it('should handle shutdown when not initialized', async () => {
      expect(jobManager.isJobManagerInitialized()).toBe(false);
      await expect(jobManager.shutdown()).resolves.not.toThrow();
    });
  });
  describe('Database Operations Integration', () => {
    it('should handle large number of users efficiently', async () => {
      const users = [];
      for (let i = 0; i < 100; i++) {
        users.push({
          username: `user${i}`,
          email: `user${i}@example.com`,
          password: 'hashedpassword',
          isActive: true
        });
      }
      await User.insertMany(users);
      const startTime = Date.now();
      const messagesPlanned = await autoMessageService.planAutomaticMessages();
      const executionTime = Date.now() - startTime;
      expect(messagesPlanned).toBe(50);
      expect(executionTime).toBeLessThan(5000);
      const autoMessages = await AutoMessage.find({});
      expect(autoMessages).toHaveLength(50);
    });
    it('should maintain data integrity with concurrent operations', async () => {
      const promises = [
        autoMessageService.planAutomaticMessages(),
        autoMessageService.planAutomaticMessages(),
        autoMessageService.planAutomaticMessages()
      ];
      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThanOrEqual(0);
      });
      const totalMessages = results.reduce((sum, count) => sum + count, 0);
      const autoMessages = await AutoMessage.find({});
      expect(autoMessages).toHaveLength(totalMessages);
    });
  });
  describe('Error Handling Integration', () => {
    it('should handle database connection errors gracefully', async () => {
      await mongoose.disconnect();
      await expect(autoMessageService.planAutomaticMessages()).rejects.toThrow();
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    });
    it('should continue operation after job execution errors', async () => {
      const originalGetActiveUsers = autoMessageService.getActiveUsers;
      let callCount = 0;
      autoMessageService.getActiveUsers = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Simulated error');
        }
        return originalGetActiveUsers.call(autoMessageService);
      });
      await expect(autoMessageService.planAutomaticMessages()).rejects.toThrow();
      const result = await autoMessageService.planAutomaticMessages();
      expect(typeof result).toBe('number');
      autoMessageService.getActiveUsers = originalGetActiveUsers;
    });
  });
});
