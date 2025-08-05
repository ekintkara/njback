import { Types } from 'mongoose';
import { ConversationService } from './conversation.service';
import Conversation from '../models/conversation.model';
import User from '../models/user.model';
import { AppError } from '../utils/app-error';

jest.mock('../utils/logger');

describe('ConversationService', () => {
  let conversationService: ConversationService;
  let user1: any;
  let user2: any;
  let user3: any;

  beforeEach(async () => {
    conversationService = new ConversationService();
    
    // Create test users
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
  });

  describe('createOrFindConversation', () => {
    it('should create a new conversation between two users', async () => {
      const result = await conversationService.createOrFindConversation({
        currentUserId: user1._id.toString(),
        participantId: user2._id.toString()
      });

      expect(result).toBeDefined();
      expect(result.participants).toHaveLength(2);
      expect(result.participants.map(p => p.toString())).toContain(user1._id.toString());
      expect(result.participants.map(p => p.toString())).toContain(user2._id.toString());
    });

    it('should return existing conversation if it already exists', async () => {
      // Create initial conversation
      const firstResult = await conversationService.createOrFindConversation({
        currentUserId: user1._id.toString(),
        participantId: user2._id.toString()
      });

      // Try to create again
      const secondResult = await conversationService.createOrFindConversation({
        currentUserId: user1._id.toString(),
        participantId: user2._id.toString()
      });

      expect(firstResult._id).toEqual(secondResult._id);
    });

    it('should find existing conversation regardless of participant order', async () => {
      // Create conversation with user1 as current user
      const firstResult = await conversationService.createOrFindConversation({
        currentUserId: user1._id.toString(),
        participantId: user2._id.toString()
      });

      // Try to create with user2 as current user
      const secondResult = await conversationService.createOrFindConversation({
        currentUserId: user2._id.toString(),
        participantId: user1._id.toString()
      });

      expect(firstResult._id).toEqual(secondResult._id);
    });

    it('should throw error for invalid user ID format', async () => {
      await expect(conversationService.createOrFindConversation({
        currentUserId: 'invalid-id',
        participantId: user2._id.toString()
      })).rejects.toThrow(AppError);
    });

    it('should throw error when trying to create conversation with self', async () => {
      await expect(conversationService.createOrFindConversation({
        currentUserId: user1._id.toString(),
        participantId: user1._id.toString()
      })).rejects.toThrow('Cannot create conversation with yourself');
    });

    it('should throw error when participant user does not exist', async () => {
      const nonExistentUserId = new Types.ObjectId().toString();
      
      await expect(conversationService.createOrFindConversation({
        currentUserId: user1._id.toString(),
        participantId: nonExistentUserId
      })).rejects.toThrow('Participant user not found');
    });
  });

  describe('getUserConversations', () => {
    beforeEach(async () => {
      // Create conversations for user1
      await Conversation.create({
        participants: [user1._id, user2._id],
        lastMessage: {
          content: 'Hello from user2',
          sender: user2._id,
          timestamp: new Date()
        }
      });

      await Conversation.create({
        participants: [user1._id, user3._id]
      });
    });

    it('should return user conversations', async () => {
      const conversations = await conversationService.getUserConversations(user1._id.toString());

      expect(conversations).toHaveLength(2);
      expect(conversations[0].participants).toHaveLength(1); // Other participant only
      expect(conversations[0].participants[0].username).toBeDefined();
    });

    it('should include last message when available', async () => {
      const conversations = await conversationService.getUserConversations(user1._id.toString());
      
      const conversationWithMessage = conversations.find(c => c.lastMessage);
      expect(conversationWithMessage).toBeDefined();
      expect(conversationWithMessage!.lastMessage!.content).toBe('Hello from user2');
    });

    it('should throw error for invalid user ID format', async () => {
      await expect(conversationService.getUserConversations('invalid-id'))
        .rejects.toThrow(AppError);
    });

    it('should return empty array for user with no conversations', async () => {
      const newUser = await User.create({
        username: 'newuser',
        email: 'new@example.com',
        password: 'Password123'
      });

      const conversations = await conversationService.getUserConversations(newUser._id.toString());
      expect(conversations).toHaveLength(0);
    });
  });

  describe('getConversationById', () => {
    let conversation: any;

    beforeEach(async () => {
      conversation = await Conversation.create({
        participants: [user1._id, user2._id]
      });
    });

    it('should return conversation for participant', async () => {
      const result = await conversationService.getConversationById(
        conversation._id.toString(),
        user1._id.toString()
      );

      expect(result._id).toEqual(conversation._id);
    });

    it('should throw error for non-participant', async () => {
      await expect(conversationService.getConversationById(
        conversation._id.toString(),
        user3._id.toString()
      )).rejects.toThrow('Access denied: You are not a participant in this conversation');
    });

    it('should throw error for non-existent conversation', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      
      await expect(conversationService.getConversationById(
        nonExistentId,
        user1._id.toString()
      )).rejects.toThrow('Conversation not found');
    });

    it('should throw error for invalid ID format', async () => {
      await expect(conversationService.getConversationById(
        'invalid-id',
        user1._id.toString()
      )).rejects.toThrow(AppError);
    });
  });

  describe('updateLastMessage', () => {
    let conversation: any;

    beforeEach(async () => {
      conversation = await Conversation.create({
        participants: [user1._id, user2._id]
      });
    });

    it('should update last message for participant', async () => {
      const messageContent = 'Test message';
      const result = await conversationService.updateLastMessage(
        conversation._id.toString(),
        messageContent,
        user1._id.toString()
      );

      expect(result.lastMessage).toBeDefined();
      expect(result.lastMessage!.content).toBe(messageContent);
      expect(result.lastMessage!.sender).toEqual(user1._id);
    });

    it('should throw error for non-participant', async () => {
      await expect(conversationService.updateLastMessage(
        conversation._id.toString(),
        'Test message',
        user3._id.toString()
      )).rejects.toThrow('Access denied: You are not a participant in this conversation');
    });

    it('should throw error for non-existent conversation', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      
      await expect(conversationService.updateLastMessage(
        nonExistentId,
        'Test message',
        user1._id.toString()
      )).rejects.toThrow('Conversation not found');
    });
  });

  describe('deleteConversation', () => {
    let conversation: any;

    beforeEach(async () => {
      conversation = await Conversation.create({
        participants: [user1._id, user2._id]
      });
    });

    it('should delete conversation for participant', async () => {
      await conversationService.deleteConversation(
        conversation._id.toString(),
        user1._id.toString()
      );

      const deletedConversation = await Conversation.findById(conversation._id);
      expect(deletedConversation).toBeNull();
    });

    it('should throw error for non-participant', async () => {
      await expect(conversationService.deleteConversation(
        conversation._id.toString(),
        user3._id.toString()
      )).rejects.toThrow('Access denied: You are not a participant in this conversation');
    });

    it('should throw error for non-existent conversation', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      
      await expect(conversationService.deleteConversation(
        nonExistentId,
        user1._id.toString()
      )).rejects.toThrow('Conversation not found');
    });
  });
});
