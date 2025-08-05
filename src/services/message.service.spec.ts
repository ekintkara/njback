import { Types } from 'mongoose';
import { messageService } from './message.service';
import Message from '../models/message.model';
import User from '../models/user.model';
import Conversation from '../models/conversation.model';
import { AppError } from '../utils/app-error';
describe('MessageService', () => {
  let user1: any;
  let user2: any;
  let user3: any;
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
    user3 = await User.create({
      username: 'testuser3',
      email: 'test3@example.com',
      password: 'Password123'
    });
    conversation = await Conversation.create({
      participants: [user1._id, user2._id]
    });
  });
  describe('getMessagesByConversationId', () => {
    beforeEach(async () => {
      const messages = [];
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
    it('should get messages with pagination successfully', async () => {
      const result = await messageService.getMessagesByConversationId(
        conversation._id.toString(),
        user1._id.toString(),
        1,
        10
      );
      expect(result.messages).toHaveLength(10);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });
    it('should populate sender information correctly', async () => {
      const result = await messageService.getMessagesByConversationId(
        conversation._id.toString(),
        user1._id.toString(),
        1,
        5
      );
      const message = result.messages[0];
      expect(message.senderId).toHaveProperty('id');
      expect(message.senderId).toHaveProperty('username');
      expect(message.senderId).toHaveProperty('email');
      expect(typeof message.senderId.username).toBe('string');
    });
    it('should handle pagination correctly for second page', async () => {
      const result = await messageService.getMessagesByConversationId(
        conversation._id.toString(),
        user1._id.toString(),
        2,
        10
      );
      expect(result.messages).toHaveLength(10);
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(true);
    });
    it('should handle last page correctly', async () => {
      const result = await messageService.getMessagesByConversationId(
        conversation._id.toString(),
        user1._id.toString(),
        3,
        10
      );
      expect(result.messages).toHaveLength(5);
      expect(result.pagination.page).toBe(3);
      expect(result.pagination.hasNext).toBe(false);
      expect(result.pagination.hasPrev).toBe(true);
    });
    it('should throw error for invalid conversation ID format', async () => {
      await expect(
        messageService.getMessagesByConversationId(
          'invalid-id',
          user1._id.toString(),
          1,
          10
        )
      ).rejects.toThrow(AppError);
    });
    it('should throw error for invalid user ID format', async () => {
      await expect(
        messageService.getMessagesByConversationId(
          conversation._id.toString(),
          'invalid-id',
          1,
          10
        )
      ).rejects.toThrow(AppError);
    });
    it('should throw error for non-existent conversation', async () => {
      const nonExistentId = new Types.ObjectId();
      await expect(
        messageService.getMessagesByConversationId(
          nonExistentId.toString(),
          user1._id.toString(),
          1,
          10
        )
      ).rejects.toThrow(AppError);
    });
    it('should throw error for non-participant user', async () => {
      await expect(
        messageService.getMessagesByConversationId(
          conversation._id.toString(),
          user3._id.toString(), 
          1,
          10
        )
      ).rejects.toThrow(AppError);
    });
    it('should validate pagination parameters', async () => {
      await expect(
        messageService.getMessagesByConversationId(
          conversation._id.toString(),
          user1._id.toString(),
          0,
          10
        )
      ).rejects.toThrow(AppError);
      await expect(
        messageService.getMessagesByConversationId(
          conversation._id.toString(),
          user1._id.toString(),
          1,
          0
        )
      ).rejects.toThrow(AppError);
      await expect(
        messageService.getMessagesByConversationId(
          conversation._id.toString(),
          user1._id.toString(),
          1,
          101
        )
      ).rejects.toThrow(AppError);
    });
  });
  describe('createMessage', () => {
    it('should create message successfully', async () => {
      const content = 'Hello, this is a test message!';
      const message = await messageService.createMessage(
        conversation._id.toString(),
        user1._id.toString(),
        content
      );
      expect(message.conversationId).toEqual(conversation._id);
      expect(message.senderId._id).toEqual(user1._id);
      expect(message.content).toBe(content);
      expect(message.isRead).toBe(false);
    });
    it('should update conversation last message', async () => {
      const content = 'Hello, this is a test message!';
      await messageService.createMessage(
        conversation._id.toString(),
        user1._id.toString(),
        content
      );
      const updatedConversation = await Conversation.findById(conversation._id);
      expect(updatedConversation?.lastMessage?.content).toBe(content);
      expect(updatedConversation?.lastMessage?.sender).toEqual(user1._id);
    });
    it('should throw error for invalid conversation ID', async () => {
      await expect(
        messageService.createMessage(
          'invalid-id',
          user1._id.toString(),
          'Test message'
        )
      ).rejects.toThrow(AppError);
    });
    it('should throw error for invalid sender ID', async () => {
      await expect(
        messageService.createMessage(
          conversation._id.toString(),
          'invalid-id',
          'Test message'
        )
      ).rejects.toThrow(AppError);
    });
    it('should throw error for empty content', async () => {
      await expect(
        messageService.createMessage(
          conversation._id.toString(),
          user1._id.toString(),
          ''
        )
      ).rejects.toThrow(AppError);
      await expect(
        messageService.createMessage(
          conversation._id.toString(),
          user1._id.toString(),
          '   '
        )
      ).rejects.toThrow(AppError);
    });
    it('should throw error for content exceeding max length', async () => {
      const longContent = 'a'.repeat(1001);
      await expect(
        messageService.createMessage(
          conversation._id.toString(),
          user1._id.toString(),
          longContent
        )
      ).rejects.toThrow(AppError);
    });
    it('should throw error for non-existent conversation', async () => {
      const nonExistentId = new Types.ObjectId();
      await expect(
        messageService.createMessage(
          nonExistentId.toString(),
          user1._id.toString(),
          'Test message'
        )
      ).rejects.toThrow(AppError);
    });
    it('should throw error for non-participant sender', async () => {
      await expect(
        messageService.createMessage(
          conversation._id.toString(),
          user3._id.toString(), 
          'Test message'
        )
      ).rejects.toThrow(AppError);
    });
    it('should trim message content', async () => {
      const content = '  Hello World  ';
      const message = await messageService.createMessage(
        conversation._id.toString(),
        user1._id.toString(),
        content
      );
      expect(message.content).toBe('Hello World');
    });
  });
});
