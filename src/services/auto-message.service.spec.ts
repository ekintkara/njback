import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Types } from 'mongoose';
import { AutoMessageService } from './auto-message.service';
import User from '../models/user.model';
import AutoMessage from '../models/auto-message.model';
import { AppError } from '../utils/app-error';
describe('AutoMessageService', () => {
  let mongoServer: MongoMemoryServer;
  let autoMessageService: AutoMessageService;
  let user1: any;
  let user2: any;
  let user3: any;
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoUri);
    autoMessageService = new AutoMessageService();
    user1 = await User.create({
      username: 'testuser1',
      email: 'test1@example.com',
      password: 'hashedpassword1',
      isActive: true
    });
    user2 = await User.create({
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'hashedpassword2',
      isActive: true
    });
    user3 = await User.create({
      username: 'testuser3',
      email: 'test3@example.com',
      password: 'hashedpassword3',
      isActive: true
    });
    await User.create({
      username: 'inactiveuser',
      email: 'inactive@example.com',
      password: 'hashedpassword',
      isActive: false
    });
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  afterEach(async () => {
    await AutoMessage.deleteMany({});
  });
  describe('getActiveUsers', () => {
    it('should return only active users', async () => {
      const activeUsers = await autoMessageService.getActiveUsers();
      expect(activeUsers).toHaveLength(3);
      expect(activeUsers.every(user => user.isActive !== false)).toBe(true);
      const usernames = activeUsers.map(user => user.username);
      expect(usernames).toContain('testuser1');
      expect(usernames).toContain('testuser2');
      expect(usernames).toContain('testuser3');
      expect(usernames).not.toContain('inactiveuser');
    });
    it('should return users with only required fields', async () => {
      const activeUsers = await autoMessageService.getActiveUsers();
      activeUsers.forEach(user => {
        expect(user).toHaveProperty('_id');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('email');
        expect(user).not.toHaveProperty('password');
      });
    });
    it('should handle database errors', async () => {
      const originalFind = User.find;
      User.find = jest.fn().mockRejectedValue(new Error('Database error'));
      await expect(autoMessageService.getActiveUsers()).rejects.toThrow(AppError);
      await expect(autoMessageService.getActiveUsers()).rejects.toThrow('Failed to retrieve active users');
      User.find = originalFind;
    });
  });
  describe('createUserPairs', () => {
    it('should create pairs from even number of users', () => {
      const users = [user1, user2, user3, { _id: new Types.ObjectId() }];
      const pairs = autoMessageService.createUserPairs(users);
      expect(pairs).toHaveLength(2);
      pairs.forEach(pair => {
        expect(pair).toHaveProperty('senderId');
        expect(pair).toHaveProperty('receiverId');
        expect(pair.senderId).not.toEqual(pair.receiverId);
      });
    });
    it('should create pairs from odd number of users (skip last)', () => {
      const users = [user1, user2, user3];
      const pairs = autoMessageService.createUserPairs(users);
      expect(pairs).toHaveLength(1);
      expect(pairs[0].senderId).not.toEqual(pairs[0].receiverId);
    });
    it('should return empty array for insufficient users', () => {
      expect(autoMessageService.createUserPairs([])).toEqual([]);
      expect(autoMessageService.createUserPairs([user1])).toEqual([]);
    });
    it('should shuffle users randomly', () => {
      const users = [user1, user2, user3, { _id: new Types.ObjectId() }];
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(autoMessageService.createUserPairs(users));
      }
      expect(results[0]).toHaveLength(2);
    });
  });
  describe('createAutoMessageData', () => {
    it('should create auto message data for pairs', () => {
      const pairs = [
        { senderId: user1._id, receiverId: user2._id },
        { senderId: user2._id, receiverId: user3._id }
      ];
      const autoMessageData = autoMessageService.createAutoMessageData(pairs);
      expect(autoMessageData).toHaveLength(2);
      autoMessageData.forEach((data, index) => {
        expect(data.senderId).toEqual(pairs[index].senderId);
        expect(data.receiverId).toEqual(pairs[index].receiverId);
        expect(typeof data.content).toBe('string');
        expect(data.content.length).toBeGreaterThan(0);
        expect(data.sendDate).toBeInstanceOf(Date);
        expect(data.sendDate.getTime()).toBeGreaterThan(Date.now());
      });
    });
    it('should generate future send dates within 1-24 hours', () => {
      const pairs = [{ senderId: user1._id, receiverId: user2._id }];
      const autoMessageData = autoMessageService.createAutoMessageData(pairs);
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      const twentyFourHours = 24 * 60 * 60 * 1000;
      const sendTime = autoMessageData[0].sendDate.getTime();
      expect(sendTime).toBeGreaterThan(now + oneHour - 60000); 
      expect(sendTime).toBeLessThan(now + twentyFourHours + 60000); 
    });
    it('should return empty array for empty pairs', () => {
      const autoMessageData = autoMessageService.createAutoMessageData([]);
      expect(autoMessageData).toEqual([]);
    });
  });
  describe('saveAutoMessages', () => {
    it('should save auto messages to database', async () => {
      const autoMessageData = [
        {
          senderId: user1._id,
          receiverId: user2._id,
          content: 'Test message 1',
          sendDate: new Date(Date.now() + 3600000)
        },
        {
          senderId: user2._id,
          receiverId: user3._id,
          content: 'Test message 2',
          sendDate: new Date(Date.now() + 7200000)
        }
      ];
      const savedMessages = await autoMessageService.saveAutoMessages(autoMessageData);
      expect(savedMessages).toHaveLength(2);
      savedMessages.forEach((message, index) => {
        expect(message.senderId).toEqual(autoMessageData[index].senderId);
        expect(message.receiverId).toEqual(autoMessageData[index].receiverId);
        expect(message.content).toBe(autoMessageData[index].content);
        expect(message.isQueued).toBe(false);
        expect(message.isSent).toBe(false);
      });
      const dbMessages = await AutoMessage.find({});
      expect(dbMessages).toHaveLength(2);
    });
    it('should return empty array for empty input', async () => {
      const savedMessages = await autoMessageService.saveAutoMessages([]);
      expect(savedMessages).toEqual([]);
    });
    it('should handle database errors', async () => {
      const originalInsertMany = AutoMessage.insertMany;
      AutoMessage.insertMany = jest.fn().mockRejectedValue(new Error('Database error'));
      const autoMessageData = [{
        senderId: user1._id,
        receiverId: user2._id,
        content: 'Test message',
        sendDate: new Date()
      }];
      await expect(autoMessageService.saveAutoMessages(autoMessageData)).rejects.toThrow(AppError);
      await expect(autoMessageService.saveAutoMessages(autoMessageData)).rejects.toThrow('Failed to save auto messages');
      AutoMessage.insertMany = originalInsertMany;
    });
  });
  describe('planAutomaticMessages', () => {
    it('should plan automatic messages successfully', async () => {
      const messagesPlanned = await autoMessageService.planAutomaticMessages();
      expect(messagesPlanned).toBe(1); 
      const dbMessages = await AutoMessage.find({});
      expect(dbMessages).toHaveLength(1);
      expect(dbMessages[0].isQueued).toBe(false);
      expect(dbMessages[0].isSent).toBe(false);
    });
    it('should return 0 when not enough active users', async () => {
      await User.updateMany({}, { isActive: false });
      const messagesPlanned = await autoMessageService.planAutomaticMessages();
      expect(messagesPlanned).toBe(0);
      const dbMessages = await AutoMessage.find({});
      expect(dbMessages).toHaveLength(0);
      await User.updateMany({}, { isActive: true });
    });
    it('should handle errors gracefully', async () => {
      const originalGetActiveUsers = autoMessageService.getActiveUsers;
      autoMessageService.getActiveUsers = jest.fn().mockRejectedValue(new Error('Service error'));
      await expect(autoMessageService.planAutomaticMessages()).rejects.toThrow(AppError);
      autoMessageService.getActiveUsers = originalGetActiveUsers;
    });
  });
});
