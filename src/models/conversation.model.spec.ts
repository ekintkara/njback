import { Types } from 'mongoose';
import Conversation, { IConversation } from './conversation.model';
import User from './user.model';

describe('Conversation Model', () => {
  let user1: any;
  let user2: any;

  beforeEach(async () => {
    
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
  });

  describe('Schema Validation', () => {
    it('should create a valid conversation with 2 participants', async () => {
      const conversation = new Conversation({
        participants: [user1._id, user2._id]
      });

      const savedConversation = await conversation.save();
      expect(savedConversation.participants).toHaveLength(2);
      expect(savedConversation.participants).toContain(user1._id);
      expect(savedConversation.participants).toContain(user2._id);
    });

    it('should fail validation with less than 2 participants', async () => {
      const conversation = new Conversation({
        participants: [user1._id]
      });

      await expect(conversation.save()).rejects.toThrow('Conversation must have exactly 2 participants');
    });

    it('should fail validation with more than 2 participants', async () => {
      const user3 = await User.create({
        username: 'testuser3',
        email: 'test3@example.com',
        password: 'Password123'
      });

      const conversation = new Conversation({
        participants: [user1._id, user2._id, user3._id]
      });

      await expect(conversation.save()).rejects.toThrow('Conversation must have exactly 2 participants');
    });

    it('should fail validation with same participant twice', async () => {
      const conversation = new Conversation({
        participants: [user1._id, user1._id]
      });

      await expect(conversation.save()).rejects.toThrow('Participants must be different users');
    });

    it('should save conversation with last message', async () => {
      const conversation = new Conversation({
        participants: [user1._id, user2._id],
        lastMessage: {
          content: 'Hello there!',
          sender: user1._id,
          timestamp: new Date()
        }
      });

      const savedConversation = await conversation.save();
      expect(savedConversation.lastMessage).toBeDefined();
      expect(savedConversation.lastMessage!.content).toBe('Hello there!');
      expect(savedConversation.lastMessage!.sender).toEqual(user1._id);
    });
  });

  describe('Static Methods', () => {
    let conversation: IConversation;

    beforeEach(async () => {
      conversation = await Conversation.create({
        participants: [user1._id, user2._id]
      });
    });

    it('should find conversation between two users', async () => {
      const foundConversation = await Conversation.findBetweenUsers(user1._id, user2._id);
      
      expect(foundConversation).toBeDefined();
      expect(foundConversation!._id).toEqual(conversation._id);
    });

    it('should find conversation regardless of participant order', async () => {
      const foundConversation = await Conversation.findBetweenUsers(user2._id, user1._id);
      
      expect(foundConversation).toBeDefined();
      expect(foundConversation!._id).toEqual(conversation._id);
    });

    it('should return null when no conversation exists between users', async () => {
      const user3 = await User.create({
        username: 'testuser3',
        email: 'test3@example.com',
        password: 'Password123'
      });

      const foundConversation = await Conversation.findBetweenUsers(user1._id, user3._id);
      expect(foundConversation).toBeNull();
    });

    it('should find user conversations', async () => {
      // Create another conversation with user1
      const user3 = await User.create({
        username: 'testuser3',
        email: 'test3@example.com',
        password: 'Password123'
      });

      await Conversation.create({
        participants: [user1._id, user3._id]
      });

      const userConversations = await Conversation.findUserConversations(user1._id);
      expect(userConversations).toHaveLength(2);
    });
  });

  describe('Instance Methods', () => {
    let conversation: IConversation;

    beforeEach(async () => {
      conversation = await Conversation.create({
        participants: [user1._id, user2._id]
      });
    });

    it('should check if user is participant', () => {
      expect(conversation.isParticipant(user1._id)).toBe(true);
      expect(conversation.isParticipant(user2._id)).toBe(true);
      
      const randomUserId = new Types.ObjectId();
      expect(conversation.isParticipant(randomUserId)).toBe(false);
    });

    it('should get other participant', () => {
      const otherParticipant1 = conversation.getOtherParticipant(user1._id);
      const otherParticipant2 = conversation.getOtherParticipant(user2._id);

      expect(otherParticipant1).toEqual(user2._id);
      expect(otherParticipant2).toEqual(user1._id);
    });

    it('should return null for non-participant', () => {
      const randomUserId = new Types.ObjectId();
      const otherParticipant = conversation.getOtherParticipant(randomUserId);
      expect(otherParticipant).toBeNull();
    });

    it('should update last message', async () => {
      const messageContent = 'Hello from test!';
      await conversation.updateLastMessage(messageContent, user1._id);

      expect(conversation.lastMessage).toBeDefined();
      expect(conversation.lastMessage!.content).toBe(messageContent);
      expect(conversation.lastMessage!.sender).toEqual(user1._id);
      expect(conversation.lastMessage!.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Indexes', () => {
    it('should have participants index', async () => {
      const indexes = await Conversation.collection.getIndexes();
      const participantsIndex = Object.keys(indexes).find(key => 
        key.includes('participants')
      );
      expect(participantsIndex).toBeDefined();
    });
  });
});
