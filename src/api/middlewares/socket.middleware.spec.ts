import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { socketAuthMiddleware, AuthenticatedSocket } from './socket.middleware';
import User from '../../models/user.model';
import { config } from '../../config/env';
jest.mock('../../models/user.model');
jest.mock('../../utils/logger');
describe('socketAuthMiddleware', () => {
  let mockSocket: Partial<Socket>;
  let mockNext: jest.Mock;
  beforeEach(() => {
    mockSocket = {
      id: 'socket-123',
      handshake: {
        headers: {},
        query: {},
        address: '127.0.0.1',
        time: new Date().toISOString(),
        xdomain: false,
        secure: false,
        issued: Date.now(),
        url: '/socket.io/',
        auth: {}
      }
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });
  it('should authenticate with valid token in authorization header', async () => {
    const mockUser = {
      _id: 'user123',
      email: 'test@example.com',
      username: 'testuser'
    };
    const token = jwt.sign(
      { userId: 'user123', email: 'test@example.com', username: 'testuser' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );
    mockSocket.handshake!.headers.authorization = `Bearer ${token}`;
    (User.findById as jest.Mock).mockResolvedValue(mockUser);
    await socketAuthMiddleware(mockSocket as Socket, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
    expect((mockSocket as AuthenticatedSocket).user).toEqual({
      userId: 'user123',
      email: 'test@example.com',
      username: 'testuser'
    });
  });
  it('should authenticate with valid token in query parameter', async () => {
    const mockUser = {
      _id: 'user123',
      email: 'test@example.com',
      username: 'testuser'
    };
    const token = jwt.sign(
      { userId: 'user123', email: 'test@example.com', username: 'testuser' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );
    mockSocket.handshake!.query.token = token;
    (User.findById as jest.Mock).mockResolvedValue(mockUser);
    await socketAuthMiddleware(mockSocket as Socket, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
    expect((mockSocket as AuthenticatedSocket).user).toEqual({
      userId: 'user123',
      email: 'test@example.com',
      username: 'testuser'
    });
  });
  it('should reject connection when no token provided', async () => {
    await socketAuthMiddleware(mockSocket as Socket, mockNext);
    expect(mockNext).toHaveBeenCalledWith(new Error('Authentication token required'));
  });
  it('should reject connection when token is invalid', async () => {
    mockSocket.handshake!.headers.authorization = 'Bearer invalid-token';
    await socketAuthMiddleware(mockSocket as Socket, mockNext);
    expect(mockNext).toHaveBeenCalledWith(new Error('Invalid token'));
  });
  it('should reject connection when token is expired', async () => {
    const expiredToken = jwt.sign(
      { userId: 'user123', email: 'test@example.com', username: 'testuser' },
      config.JWT_SECRET,
      { expiresIn: '-1h' }
    );
    mockSocket.handshake!.headers.authorization = `Bearer ${expiredToken}`;
    await socketAuthMiddleware(mockSocket as Socket, mockNext);
    expect(mockNext).toHaveBeenCalledWith(new Error('Token expired'));
  });
  it('should reject connection when user not found', async () => {
    const token = jwt.sign(
      { userId: 'nonexistent', email: 'test@example.com', username: 'testuser' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );
    mockSocket.handshake!.headers.authorization = `Bearer ${token}`;
    (User.findById as jest.Mock).mockResolvedValue(null);
    await socketAuthMiddleware(mockSocket as Socket, mockNext);
    expect(mockNext).toHaveBeenCalledWith(new Error('User not found'));
  });
  it('should handle database errors gracefully', async () => {
    const token = jwt.sign(
      { userId: 'user123', email: 'test@example.com', username: 'testuser' },
      config.JWT_SECRET,
      { expiresIn: '1h' }
    );
    mockSocket.handshake!.headers.authorization = `Bearer ${token}`;
    (User.findById as jest.Mock).mockRejectedValue(new Error('Database error'));
    await socketAuthMiddleware(mockSocket as Socket, mockNext);
    expect(mockNext).toHaveBeenCalledWith(new Error('Authentication failed'));
  });
});
