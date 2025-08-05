import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import Logger from '../utils/logger';
import { AuthenticatedSocket } from '../types/socket.types';
export interface SocketAuthPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}
export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      Logger.warn('[SOCKET] Authentication failed: No token provided', {
        socketId: socket.id,
        ip: socket.handshake.address,
        category: 'socket'
      });
      return next(new Error('Authentication failed: No token provided'));
    }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      Logger.error('[SOCKET] JWT_SECRET not configured', new Error('JWT_SECRET not configured'), {
        category: 'socket'
      });
      return next(new Error('Server configuration error'));
    }
    let decoded: SocketAuthPayload;
    try {
      decoded = jwt.verify(token, jwtSecret) as SocketAuthPayload;
    } catch (jwtError) {
      Logger.warn('[SOCKET] Authentication failed: Invalid token', {
        socketId: socket.id,
        ip: socket.handshake.address,
        error: jwtError instanceof Error ? jwtError.message : 'Unknown JWT error',
        category: 'socket'
      });
      return next(new Error('Authentication failed: Invalid token'));
    }
    const user = await User.findById(decoded.userId).select('username email');
    if (!user) {
      Logger.warn('[SOCKET] Authentication failed: User not found', {
        socketId: socket.id,
        userId: decoded.userId,
        category: 'socket'
      });
      return next(new Error('Authentication failed: User not found'));
    }
    const authenticatedSocket = socket as AuthenticatedSocket;
    authenticatedSocket.userId = user._id.toString();
    authenticatedSocket.user = {
      _id: user._id.toString(),
      username: user.username,
      email: user.email
    };
    Logger.info('[SOCKET] User authenticated successfully', {
      socketId: socket.id,
      userId: user._id.toString(),
      username: user.username,
      ip: socket.handshake.address,
      category: 'socket'
    });
    next();
  } catch (error) {
    Logger.error('[SOCKET] Authentication middleware error', error instanceof Error ? error : new Error('Unknown error'), {
      socketId: socket.id,
      category: 'socket'
    });
    next(new Error('Authentication failed: Server error'));
  }
};
export const requireAuth = (socket: AuthenticatedSocket): boolean => {
  if (!socket.userId || !socket.user) {
    socket.emit('error', {
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
    return false;
  }
  return true;
};
export const getUserRoom = (userId: string): string => {
  return `user:${userId}`;
};
export const getConversationRoom = (conversationId: string): string => {
  return `conversation:${conversationId}`;
};
