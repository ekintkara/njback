import request from 'supertest';
import { createApp } from '../src/app';
import User from '../src/models/user.model';

describe('Auth Integration Tests', () => {
  const app = createApp();

  describe('POST /api/auth/register', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123'
    };

    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'User registered successfully');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');

      const user = await User.findOne({ email: validUserData.email });
      expect(user).toBeTruthy();
      expect(user?.username).toBe(validUserData.username);
    });

    it('should return 400 for duplicate email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validUserData,
          username: 'differentuser'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('email already exists');
    });

    it('should return 400 for duplicate username', async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validUserData,
          email: 'different@example.com'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('username already exists');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validUserData,
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validUserData,
          password: 'weak'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid username format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validUserData,
          username: 'ab' // Too short
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should not return password in response', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body.data).not.toHaveProperty('password');
    });
  });

  describe('POST /api/auth/login', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123'
    };

    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUserData.email,
          password: validUserData.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should return 401 for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: validUserData.password
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should return 401 for wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUserData.email,
          password: 'WrongPassword123'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid email or password');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: validUserData.password
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: validUserData.email
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: validUserData.password
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/refresh', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123'
    };

    let refreshToken: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      refreshToken = response.body.data.refreshToken;
    });

    it('should refresh tokens successfully with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Tokens refreshed successfully');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.accessToken).not.toBe(refreshToken);
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid or expired refresh token');
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for empty refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: '' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return 401 for expired refresh token', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzM0NTY3ODkwYWJjZGVmMTIzNDU2NzgiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.invalid';

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: expiredToken })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Invalid or expired refresh token');
    });
  });
});
