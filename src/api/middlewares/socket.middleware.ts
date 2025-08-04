import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import User from '../../models/user.model';
import Logger from '../../utils/logger';

export interface AuthenticatedSocket extends Socket {
  user: {
    userId: string;
    email: string;
    username: string;
  };
}

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  iat: number;
  exp: number;
}

export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    let token: string | undefined;

    if (socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token as string;
    } else {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else if (socket.handshake.query.token) {
        token = socket.handshake.query.token as string;
      }
    }

    if (!token) {
      Logger.security('Socket connection rejected - no token provided', {
        socketId: socket.id,
        ip: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      Logger.security('Socket connection rejected - user not found', {
        socketId: socket.id,
        userId: decoded.userId,
        ip: socket.handshake.address
      });
      return next(new Error('User not found'));
    }

    // Attach user to socket
    (socket as AuthenticatedSocket).user = {
      userId: user._id.toString(),
      email: user.email,
      username: user.username
    };

    Logger.auth('Socket connection authenticated', {
      socketId: socket.id,
      userId: user._id.toString(),
      username: user.username,
      ip: socket.handshake.address
    });

    next();
  } catch (error) {
    Logger.error('Socket authentication failed', error as Error, {
      socketId: socket.id,
      ip: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent']
    });

    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Invalid token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      return next(new Error('Token expired'));
    } else {
      return next(new Error('Authentication failed'));
    }
  }
};
