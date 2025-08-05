import { Types } from 'mongoose';
import Message from './message.model';
import User from './user.model';
import Conversation from './conversation.model';
describe('Message Model', () => {
  let user1: any;
  let user2: any;
  let conversation: any;
  beforeEach(async () => {
    user1 = await User.create({
      username: 'testuser1',
      email: 'test1@example.com',
      password: 'Password123'
    });
    user2 = await User.create({
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'Password123'
    });
    conversation = await Conversation.create({
      participants: [user1._id, user2._id]
    });
  });
  describe('Schema Validation', () => {
    it('should create a valid message', async () => {
      const message = new Message({
        conversationId: conversation._id,
        senderId: user1._id,
        content: 'Hello, this is a test message!'
      });
      const savedMessage = await message.save();
      expect(savedMessage.conversationId).toEqual(conversation._id);
      expect(savedMessage.senderId).toEqual(user1._id);
      expect(savedMessage.content).toBe('Hello, this is a test message!');
      expect(savedMessage.isRead).toBe(false);
      expect(savedMessage.createdAt).toBeDefined();
      expect(savedMessage.updatedAt).toBeDefined();
    });
    it('should fail validation without conversationId', async () => {
      const message = new Message({
        senderId: user1._id,
        content: 'Test message'
      });
      await expect(message.save()).rejects.toThrow('Path `conversationId` is required');
    });
    it('should fail validation without senderId', async () => {
      const message = new Message({
        conversationId: conversation._id,
        content: 'Test message'
      });
      await expect(message.save()).rejects.toThrow('Path `senderId` is required');
    });
    it('should fail validation without content', async () => {
      const message = new Message({
        conversationId: conversation._id,
        senderId: user1._id
      });
      await expect(message.save()).rejects.toThrow('Path `content` is required');
    });
    it('should fail validation with content exceeding maxlength', async () => {
      const longContent = 'a'.repeat(1001);
      const message = new Message({
        conversationId: conversation._id,
        senderId: user1._id,
        content: longContent
      });
      await expect(message.save()).rejects.toThrow();
    });
    it('should trim content whitespace', async () => {
      const message = new Message({
        conversationId: conversation._id,
        senderId: user1._id,
        content: '  Hello World  '
      });
      const savedMessage = await message.save();
      expect(savedMessage.content).toBe('Hello World');
    });
  });
  describe('Static Methods', () => {
    beforeEach(async () => {
      const messages: any[] = [];
      for (let i = 1; i <= 25; i++) {
        messages.push({
          conversationId: conversation._id,
          senderId: i % 2 === 0 ? user1._id : user2._id,
          content: `Test message ${i}`,
          createdAt: new Date(Date.now() + i * 1000) 
        });
      }
      await Message.insertMany(messages);
    });
    it('should find messages by conversation with pagination', async () => {
      const result = await Message.findByConversationId(conversation._id, 1, 10);
      expect(result.messages).toHaveLength(10);
      expect(result.total).toBe(25);
      const messages = result.messages;
      for (let i = 0; i < messages.length - 1; i++) {
        expect(new Date(messages[i].createdAt).getTime())
          .toBeGreaterThanOrEqual(new Date(messages[i + 1].createdAt).getTime());
      }
    });
    it('should populate sender information', async () => {
      const result = await Message.findByConversationId(conversation._id, 1, 5);
      expect(result.messages[0].senderId).toHaveProperty('username');
      expect(result.messages[0].senderId).toHaveProperty('email');
    });
    it('should handle pagination correctly', async () => {
      const page1 = await Message.findByConversationId(conversation._id, 1, 10);
      expect(page1.messages).toHaveLength(10);
      expect(page1.total).toBe(25);
      const page2 = await Message.findByConversationId(conversation._id, 2, 10);
      expect(page2.messages).toHaveLength(10);
      expect(page2.total).toBe(25);
      const page3 = await Message.findByConversationId(conversation._id, 3, 10);
      expect(page3.messages).toHaveLength(5);
      expect(page3.total).toBe(25);
      const page1Ids = page1.messages.map(m => m._id.toString());
      const page2Ids = page2.messages.map(m => m._id.toString());
      const intersection = page1Ids.filter(id => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });
    it('should return empty array for non-existent conversation', async () => {
      const nonExistentId = new Types.ObjectId();
      const result = await Message.findByConversationId(nonExistentId, 1, 10);
      expect(result.messages).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
  describe('JSON Transformation', () => {
    it('should transform _id to id in JSON output', async () => {
      const message = await Message.create({
        conversationId: conversation._id,
        senderId: user1._id,
        content: 'Test message'
      });
      const json = message.toJSON();
      expect(json.id).toBeDefined();
      expect(json._id).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });
});
