import { AuthService } from './auth.service';
import User from '../models/user.model';
import { AppError } from '../utils/app-error';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  describe('register', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123'
    };

    it('should successfully register a new user', async () => {
      const result = await authService.register(validUserData);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');

      const user = await User.findOne({ email: validUserData.email });
      expect(user).toBeTruthy();
      expect(user?.username).toBe(validUserData.username);
      expect(user?.email).toBe(validUserData.email);
      expect(user?.password).not.toBe(validUserData.password);
    });

    it('should throw error when email already exists', async () => {
      await authService.register(validUserData);

      await expect(
        authService.register({
          ...validUserData,
          username: 'differentuser'
        })
      ).rejects.toThrow(AppError);
    });

    it('should throw error when username already exists', async () => {
      await authService.register(validUserData);

      await expect(
        authService.register({
          ...validUserData,
          email: 'different@example.com'
        })
      ).rejects.toThrow(AppError);
    });

    it('should hash password before saving', async () => {
      await authService.register(validUserData);

      const user = await User.findOne({ email: validUserData.email });
      expect(user?.password).not.toBe(validUserData.password);
      expect(user?.password.length).toBeGreaterThan(50);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const { accessToken } = await authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123'
      });

      const decoded = await authService.verifyAccessToken(accessToken);
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('email');
      expect(decoded).toHaveProperty('username');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.username).toBe('testuser');
    });

    it('should throw error for invalid token', async () => {
      await expect(
        authService.verifyAccessToken('invalid-token')
      ).rejects.toThrow(AppError);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', async () => {
      const { refreshToken } = await authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123'
      });

      const decoded = await authService.verifyRefreshToken(refreshToken);
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('email');
      expect(decoded).toHaveProperty('username');
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(
        authService.verifyRefreshToken('invalid-refresh-token')
      ).rejects.toThrow(AppError);
    });
  });

  describe('login', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123'
    };

    beforeEach(async () => {
      await authService.register(validUserData);
    });

    it('should successfully login with valid credentials', async () => {
      const result = await authService.login({
        email: validUserData.email,
        password: validUserData.password
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
    });

    it('should throw error for non-existent email', async () => {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: validUserData.password
        })
      ).rejects.toThrow(AppError);
    });

    it('should throw error for wrong password', async () => {
      await expect(
        authService.login({
          email: validUserData.email,
          password: 'WrongPassword123'
        })
      ).rejects.toThrow(AppError);
    });

    it('should return same user info in token payload', async () => {
      const { accessToken } = await authService.login({
        email: validUserData.email,
        password: validUserData.password
      });

      const decoded = await authService.verifyAccessToken(accessToken);
      expect(decoded.email).toBe(validUserData.email);
      expect(decoded.username).toBe(validUserData.username);
    });
  });

  describe('refreshTokens', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123'
    };

    let refreshToken: string;

    beforeEach(async () => {
      const tokens = await authService.register(validUserData);
      refreshToken = tokens.refreshToken;
    });

    it('should successfully refresh tokens with valid refresh token', async () => {
      const result = await authService.refreshTokens({ refreshToken });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.accessToken).not.toBe(refreshToken);
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(
        authService.refreshTokens({ refreshToken: 'invalid-refresh-token' })
      ).rejects.toThrow(AppError);
    });

    it('should throw error for expired refresh token', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzM0NTY3ODkwYWJjZGVmMTIzNDU2NzgiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.invalid';

      await expect(
        authService.refreshTokens({ refreshToken: expiredToken })
      ).rejects.toThrow(AppError);
    });

    it('should return new tokens with same user info', async () => {
      const result = await authService.refreshTokens({ refreshToken });

      const decoded = await authService.verifyAccessToken(result.accessToken);
      expect(decoded.email).toBe(validUserData.email);
      expect(decoded.username).toBe(validUserData.username);
    });

    it('should throw error if user no longer exists', async () => {
      await User.findOneAndDelete({ email: validUserData.email });

      await expect(
        authService.refreshTokens({ refreshToken })
      ).rejects.toThrow(AppError);
    });
  });

  describe('updateProfile', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123'
    };

    let userId: string;

    beforeEach(async () => {
      await authService.register(validUserData);
      const user = await User.findOne({ email: validUserData.email });
      userId = user!._id.toString();
    });

    it('should successfully update username', async () => {
      const updateData = { username: 'newusername' };

      const result = await authService.updateProfile(userId, updateData);

      expect(result.username).toBe('newusername');
      expect(result.email).toBe(validUserData.email);
    });

    it('should successfully update email', async () => {
      const updateData = { email: 'newemail@example.com' };

      const result = await authService.updateProfile(userId, updateData);

      expect(result.email).toBe('newemail@example.com');
      expect(result.username).toBe(validUserData.username);
    });

    it('should successfully update both username and email', async () => {
      const updateData = {
        username: 'newusername',
        email: 'newemail@example.com'
      };

      const result = await authService.updateProfile(userId, updateData);

      expect(result.username).toBe('newusername');
      expect(result.email).toBe('newemail@example.com');
    });

    it('should throw error for duplicate email', async () => {
      await authService.register({
        username: 'anotheruser',
        email: 'another@example.com',
        password: 'Password123'
      });

      await expect(
        authService.updateProfile(userId, { email: 'another@example.com' })
      ).rejects.toThrow(AppError);
    });

    it('should throw error for duplicate username', async () => {
      await authService.register({
        username: 'anotheruser',
        email: 'another@example.com',
        password: 'Password123'
      });

      await expect(
        authService.updateProfile(userId, { username: 'anotheruser' })
      ).rejects.toThrow(AppError);
    });

    it('should throw error when no fields provided', async () => {
      await expect(
        authService.updateProfile(userId, {})
      ).rejects.toThrow(AppError);
    });

    it('should throw error for non-existent user', async () => {
      const fakeUserId = '507f1f77bcf86cd799439011';

      await expect(
        authService.updateProfile(fakeUserId, { username: 'newusername' })
      ).rejects.toThrow(AppError);
    });

    it('should allow updating to same values', async () => {
      const updateData = {
        username: validUserData.username,
        email: validUserData.email
      };

      const result = await authService.updateProfile(userId, updateData);

      expect(result.username).toBe(validUserData.username);
      expect(result.email).toBe(validUserData.email);
    });
  });

  describe('logout', () => {
    const validUserData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123'
    };

    let refreshToken: string;

    beforeEach(async () => {
      const tokens = await authService.register(validUserData);
      refreshToken = tokens.refreshToken;
    });

    it('should successfully logout with valid refresh token', async () => {
      await expect(
        authService.logout({ refreshToken })
      ).resolves.not.toThrow();
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(
        authService.logout({ refreshToken: 'invalid-refresh-token' })
      ).rejects.toThrow(AppError);
    });

    it('should throw error for expired refresh token', async () => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzM0NTY3ODkwYWJjZGVmMTIzNDU2NzgiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.invalid';

      await expect(
        authService.logout({ refreshToken: expiredToken })
      ).rejects.toThrow(AppError);
    });

    it('should throw error if user no longer exists', async () => {
      await User.findOneAndDelete({ email: validUserData.email });

      await expect(
        authService.logout({ refreshToken })
      ).rejects.toThrow(AppError);
    });
  });
});
