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
});
