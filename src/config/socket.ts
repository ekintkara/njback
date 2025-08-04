import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { config } from './env';
import Logger from '../utils/logger';

export interface SocketConfig {
  cors: {
    origin: string | string[];
    methods: string[];
    credentials: boolean;
  };
  pingTimeout: number;
  pingInterval: number;
}

export const socketConfig: SocketConfig = {
  cors: {
    origin: config.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT || '60000'),
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL || '25000')
};

export const createSocketServer = (httpServer: HTTPServer): SocketIOServer => {
  const io = new SocketIOServer(httpServer, socketConfig);

  Logger.info('Socket.IO server created', {
    cors: socketConfig.cors,
    pingTimeout: socketConfig.pingTimeout,
    pingInterval: socketConfig.pingInterval
  });

  return io;
};

export default createSocketServer;
