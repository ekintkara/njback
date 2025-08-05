import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import User from '../../src/models/user.model';
import Conversation from '../../src/models/conversation.model';
import Message from '../../src/models/message.model';
import jwt from 'jsonwebtoken';

describe('Message Integration Tests', () => {
  let app: Application;
  let user1: any;
  let user2: any;
  let user3: any;
  let conversation: any;
  let token1: string;

  let token3: string;

  beforeAll(async () => {
    app = createApp();
  });

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

    user3 = await User.create({
      username: 'testuser3',
      email: 'test3@example.com',
      password: 'Password123'
    });

    // Generate tokens
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    token1 = jwt.sign(
      { userId: user1._id.toString(), email: user1.email, username: user1.username },
      jwtSecret,
      { expiresIn: '1h' }
    );
    token3 = jwt.sign(
      { userId: user3._id.toString(), email: user3.email, username: user3.username },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // Create test conversation
    conversation = await Conversation.create({
      participants: [user1._id, user2._id]
    });

    // Create test messages
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

  describe('GET /api/messages/:conversationId', () => {
    it('should get messages with default pagination', async () => {
      const response = await request(app)
        .get(`/api/messages/${conversation._id}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Messages retrieved successfully');
      expect(response.body.data.messages).toHaveLength(20); // Default limit
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(20);
      expect(response.body.data.pagination.total).toBe(25);
      expect(response.body.data.pagination.totalPages).toBe(2);
      expect(response.body.data.pagination.hasNext).toBe(true);
      expect(response.body.data.pagination.hasPrev).toBe(false);

      // Check message structure
      const message = response.body.data.messages[0];
      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('conversationId');
      expect(message).toHaveProperty('senderId');
      expect(message.senderId).toHaveProperty('id');
      expect(message.senderId).toHaveProperty('username');
      expect(message.senderId).toHaveProperty('email');
      expect(message).toHaveProperty('content');
      expect(message).toHaveProperty('isRead');
      expect(message).toHaveProperty('createdAt');
      expect(message).toHaveProperty('updatedAt');
    });

    it('should get messages with custom pagination', async () => {
      const response = await request(app)
        .get(`/api/messages/${conversation._id}?page=2&limit=10`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      expect(response.body.data.messages).toHaveLength(10);
      expect(response.body.data.pagination.page).toBe(2);
      expect(response.body.data.pagination.limit).toBe(10);
      expect(response.body.data.pagination.total).toBe(25);
      expect(response.body.data.pagination.totalPages).toBe(3);
      expect(response.body.data.pagination.hasNext).toBe(true);
      expect(response.body.data.pagination.hasPrev).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get(`/api/messages/${conversation._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token is required');
    });

    it('should return 403 for non-participant user', async () => {
      const response = await request(app)
        .get(`/api/messages/${conversation._id}`)
        .set('Authorization', `Bearer ${token3}`) // user3 is not a participant
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied: You are not a participant in this conversation');
    });

    it('should return 400 for invalid conversation ID', async () => {
      const response = await request(app)
        .get('/api/messages/invalid-id')
        .set('Authorization', `Bearer ${token1}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual({
        type: 'field',
        msg: 'Invalid conversation ID format',
        path: 'conversationId',
        location: 'params',
        value: 'invalid-id'
      });
    });

    it('should return 404 for non-existent conversation', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/messages/${nonExistentId}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Conversation not found');
    });

    it('should validate pagination parameters', async () => {
      // Invalid page
      const response1 = await request(app)
        .get(`/api/messages/${conversation._id}?page=0`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(400);

      expect(response1.body.success).toBe(false);
      expect(response1.body.errors).toContainEqual({
        type: 'field',
        msg: 'Page must be a positive integer',
        path: 'page',
        location: 'query',
        value: 0
      });

      // Invalid limit
      const response2 = await request(app)
        .get(`/api/messages/${conversation._id}?limit=101`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(400);

      expect(response2.body.success).toBe(false);
      expect(response2.body.errors).toContainEqual({
        type: 'field',
        msg: 'Limit must be between 1 and 100',
        path: 'limit',
        location: 'query',
        value: 101
      });
    });

    it('should sort messages by creation date descending', async () => {
      const response = await request(app)
        .get(`/api/messages/${conversation._id}`)
        .set('Authorization', `Bearer ${token1}`)
        .expect(200);

      const messages = response.body.data.messages;
      for (let i = 0; i < messages.length - 1; i++) {
        const currentDate = new Date(messages[i].createdAt);
        const nextDate = new Date(messages[i + 1].createdAt);
        expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
      }
    });
  });

  describe('POST /api/messages', () => {
    it('should create message successfully', async () => {
      const messageData = {
        conversationId: conversation._id.toString(),
        content: 'Hello, this is a new test message!'
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token1}`)
        .send(messageData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Message created successfully');
      expect(response.body.data.message).toHaveProperty('_id');
      expect(response.body.data.message.conversationId).toBe(conversation._id.toString());
      expect(response.body.data.message.senderId._id).toBe(user1._id.toString());
      expect(response.body.data.message.content).toBe(messageData.content);
      expect(response.body.data.message.isRead).toBe(false);

      // Verify message was saved to database
      const savedMessage = await Message.findById(response.body.data.message._id);
      expect(savedMessage).toBeTruthy();
      expect(savedMessage!.content).toBe(messageData.content);
    });

    it('should return 401 without authentication', async () => {
      const messageData = {
        conversationId: conversation._id.toString(),
        content: 'Test message'
      };

      const response = await request(app)
        .post('/api/messages')
        .send(messageData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token is required');
    });

    it('should return 403 for non-participant user', async () => {
      const messageData = {
        conversationId: conversation._id.toString(),
        content: 'Test message'
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token3}`) // user3 is not a participant
        .send(messageData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access denied: You are not a participant in this conversation');
    });

    it('should validate required fields', async () => {
      // Missing conversationId
      const response1 = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token1}`)
        .send({ content: 'Test message' })
        .expect(400);

      expect(response1.body.success).toBe(false);
      expect(response1.body.errors).toContainEqual({
        type: 'field',
        msg: 'Conversation ID is required',
        path: 'conversationId',
        location: 'body'
      });

      // Missing content
      const response2 = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token1}`)
        .send({ conversationId: conversation._id.toString() })
        .expect(400);

      expect(response2.body.success).toBe(false);
      expect(response2.body.errors).toContainEqual({
        type: 'field',
        msg: 'Message content is required',
        path: 'content',
        location: 'body'
      });
    });

    it('should validate content length', async () => {
      const longContent = 'a'.repeat(1001);
      const messageData = {
        conversationId: conversation._id.toString(),
        content: longContent
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token1}`)
        .send(messageData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContainEqual({
        type: 'field',
        msg: 'Message content must be between 1 and 1000 characters',
        path: 'content',
        location: 'body',
        value: longContent
      });
    });

    it('should trim message content', async () => {
      const messageData = {
        conversationId: conversation._id.toString(),
        content: '  Hello World  '
      };

      const response = await request(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token1}`)
        .send(messageData)
        .expect(201);

      expect(response.body.data.message.content).toBe('Hello World');
    });
  });
});
