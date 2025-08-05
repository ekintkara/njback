import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import AutoMessage from './auto-message.model';
import User from './user.model';
describe('AutoMessage Model', () => {
  let mongoServer: MongoMemoryServer;
  let user1: any;
  let user2: any;
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoUri);
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
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  afterEach(async () => {
    await AutoMessage.deleteMany({});
  });
  describe('Schema Validation', () => {
    it('should create a valid auto message', async () => {
      const sendDate = new Date(Date.now() + 3600000); 
      const autoMessage = new AutoMessage({
        senderId: user1._id,
        receiverId: user2._id,
        content: 'Test auto message',
        sendDate
      });
      const savedMessage = await autoMessage.save();
      expect(savedMessage.senderId).toEqual(user1._id);
      expect(savedMessage.receiverId).toEqual(user2._id);
      expect(savedMessage.content).toBe('Test auto message');
      expect(savedMessage.sendDate).toEqual(sendDate);
      expect(savedMessage.isQueued).toBe(false);
      expect(savedMessage.isSent).toBe(false);
      expect(savedMessage.createdAt).toBeDefined();
      expect(savedMessage.updatedAt).toBeDefined();
    });
    it('should fail validation with missing required fields', async () => {
      const autoMessage = new AutoMessage({
        senderId: user1._id,
      });
      await expect(autoMessage.save()).rejects.toThrow();
    });
    it('should fail validation with invalid ObjectId', async () => {
      const autoMessage = new AutoMessage({
        senderId: 'invalid-id',
        receiverId: user2._id,
        content: 'Test message',
        sendDate: new Date()
      });
      await expect(autoMessage.save()).rejects.toThrow();
    });
    it('should fail validation with content exceeding maxlength', async () => {
      const longContent = 'a'.repeat(1001);
      const autoMessage = new AutoMessage({
        senderId: user1._id,
        receiverId: user2._id,
        content: longContent,
        sendDate: new Date()
      });
      await expect(autoMessage.save()).rejects.toThrow();
    });
    it('should trim content whitespace', async () => {
      const autoMessage = new AutoMessage({
        senderId: user1._id,
        receiverId: user2._id,
        content: '  Test message  ',
        sendDate: new Date()
      });
      const savedMessage = await autoMessage.save();
      expect(savedMessage.content).toBe('Test message');
    });
  });
  describe('Static Methods', () => {
    beforeEach(async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 3600000); 
      const futureDate = new Date(now.getTime() + 3600000); 
      await AutoMessage.create([
        {
          senderId: user1._id,
          receiverId: user2._id,
          content: 'Past message 1',
          sendDate: pastDate,
          isQueued: false,
          isSent: false
        },
        {
          senderId: user2._id,
          receiverId: user1._id,
          content: 'Past message 2',
          sendDate: pastDate,
          isQueued: true,
          isSent: false
        },
        {
          senderId: user1._id,
          receiverId: user2._id,
          content: 'Future message',
          sendDate: futureDate,
          isQueued: false,
          isSent: false
        }
      ]);
    });
    it('should find pending messages', async () => {
      const currentDate = new Date();
      const pendingMessages = await AutoMessage.findPendingMessages(currentDate);
      expect(pendingMessages).toHaveLength(1);
      expect(pendingMessages[0].content).toBe('Past message 1');
      expect(pendingMessages[0].isQueued).toBe(false);
      expect(pendingMessages[0].isSent).toBe(false);
    });
    it('should mark messages as queued', async () => {
      const messages = await AutoMessage.find({ isQueued: false });
      const messageIds = messages.map(msg => msg._id);
      await AutoMessage.markAsQueued(messageIds);
      const updatedMessages = await AutoMessage.find({ _id: { $in: messageIds } });
      updatedMessages.forEach(msg => {
        expect(msg.isQueued).toBe(true);
      });
    });
    it('should mark message as sent', async () => {
      const message = await AutoMessage.findOne({ content: 'Past message 1' });
      const updatedMessage = await AutoMessage.markAsSent(message!._id);
      expect(updatedMessage!.isSent).toBe(true);
    });
  });
  describe('JSON Transformation', () => {
    it('should transform _id to id in JSON output', async () => {
      const autoMessage = await AutoMessage.create({
        senderId: user1._id,
        receiverId: user2._id,
        content: 'Test message',
        sendDate: new Date()
      });
      const json = autoMessage.toJSON();
      expect(json.id).toBeDefined();
      expect(json._id).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });
  describe('Indexes', () => {
    it('should have proper indexes for efficient queries', async () => {
      const indexes = await AutoMessage.collection.getIndexes();
      const indexNames = Object.keys(indexes);
      expect(indexNames).toContain('sendDate_1_isQueued_1');
      expect(indexNames).toContain('isQueued_1_isSent_1');
      expect(indexNames).toContain('senderId_1_createdAt_-1');
      expect(indexNames).toContain('receiverId_1_createdAt_-1');
    });
  });
});
