import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { socketAuthMiddleware, requireAuth, getUserRoom, getConversationRoom } from './socket.middleware';
import { AuthenticatedSocket } from '../types/socket.types';
import User from '../models/user.model';
jest.mock('../models/user.model', () => ({
  findById: jest.fn().mockReturnValue({
    select: jest.fn()
  })
}));
jest.mock('jsonwebtoken');
jest.mock('../utils/logger');
describe('Socket Middleware', () => {
  let mockSocket: Partial<Socket>;
  let mockNext: jest.Mock;
  beforeEach(() => {
    mockSocket = {
      id: 'socket123',
      handshake: {
        auth: {},
        query: {},
        address: '127.0.0.1',
        headers: {},
        time: new Date().toISOString(),
        xdomain: false,
        secure: false,
        issued: Date.now(),
        url: '/socket.io/'
      },
      emit: jest.fn()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });
  describe('socketAuthMiddleware', () => {
    const mockUserData = {
      _id: 'user123',
      username: 'testuser',
      email: 'test@example.com'
    };
    beforeEach(() => {
      process.env.JWT_SECRET = 'test-secret';
    });
    it('should authenticate user with valid token in auth', async () => {
      const token = 'valid-token';
      mockSocket.handshake!.auth!.token = token;
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: 'user123',
        email: 'test@example.com'
      });
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUserData)
      });
      await socketAuthMiddleware(mockSocket as Socket, mockNext);
      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret');
      expect(User.findById).toHaveBeenCalledWith('user123');
      expect((mockSocket as AuthenticatedSocket).userId).toBe('user123');
      expect((mockSocket as AuthenticatedSocket).user).toEqual({
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com'
      });
      expect(mockNext).toHaveBeenCalledWith();
    });
    it('should authenticate user with valid token in query', async () => {
      const token = 'valid-token';
      mockSocket.handshake!.query!.token = token;
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: 'user123',
        email: 'test@example.com'
      });
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUserData)
      });
      await socketAuthMiddleware(mockSocket as Socket, mockNext);
      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret');
      expect(mockNext).toHaveBeenCalledWith();
    });
    it('should reject when no token provided', async () => {
      await socketAuthMiddleware(mockSocket as Socket, mockNext);
      expect(mockNext).toHaveBeenCalledWith(new Error('Authentication failed: No token provided'));
    });
    it('should reject when JWT_SECRET not configured', async () => {
      delete process.env.JWT_SECRET;
      mockSocket.handshake!.auth!.token = 'some-token';
      await socketAuthMiddleware(mockSocket as Socket, mockNext);
      expect(mockNext).toHaveBeenCalledWith(new Error('Server configuration error'));
    });
    it('should reject when token is invalid', async () => {
      mockSocket.handshake!.auth!.token = 'invalid-token';
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      await socketAuthMiddleware(mockSocket as Socket, mockNext);
      expect(mockNext).toHaveBeenCalledWith(new Error('Authentication failed: Invalid token'));
    });
    it('should reject when user not found', async () => {
      mockSocket.handshake!.auth!.token = 'valid-token';
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: 'user123',
        email: 'test@example.com'
      });
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });
      await socketAuthMiddleware(mockSocket as Socket, mockNext);
      expect(mockNext).toHaveBeenCalledWith(new Error('Authentication failed: User not found'));
    });
    it('should handle database errors', async () => {
      mockSocket.handshake!.auth!.token = 'valid-token';
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: 'user123',
        email: 'test@example.com'
      });
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockRejectedValue(new Error('Database error'))
      });
      await socketAuthMiddleware(mockSocket as Socket, mockNext);
      expect(mockNext).toHaveBeenCalledWith(new Error('Authentication failed: Server error'));
    });
  });
  describe('requireAuth', () => {
    it('should return true for authenticated socket', () => {
      const authenticatedSocket = {
        userId: 'user123',
        user: { _id: 'user123', username: 'test', email: 'test@example.com' },
        emit: jest.fn()
      } as unknown as AuthenticatedSocket;
      const result = requireAuth(authenticatedSocket);
      expect(result).toBe(true);
      expect(authenticatedSocket.emit).not.toHaveBeenCalled();
    });
    it('should return false and emit error for unauthenticated socket', () => {
      const unauthenticatedSocket = {
        emit: jest.fn()
      } as unknown as AuthenticatedSocket;
      const result = requireAuth(unauthenticatedSocket);
      expect(result).toBe(false);
      expect(unauthenticatedSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    });
  });
  describe('Room helpers', () => {
    it('should generate correct user room name', () => {
      const result = getUserRoom('user123');
      expect(result).toBe('user:user123');
    });
    it('should generate correct conversation room name', () => {
      const result = getConversationRoom('conv123');
      expect(result).toBe('conversation:conv123');
    });
  });
});
