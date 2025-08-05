import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Logger from '../utils/logger';
import { socketAuthMiddleware } from './socket.middleware';
import { SocketController } from './socket.controller';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  AuthenticatedSocket
} from '../types/socket.types';
export class SocketService {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private socketController: SocketController;
  private connectedUsers: Map<string, Set<string>> = new Map(); 
  private userSockets: Map<string, string> = new Map(); 
  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });
    this.socketController = new SocketController(this.io);
    this.setupMiddleware();
    this.setupEventHandlers();
    Logger.info('[SOCKET] Socket.IO server initialized', {
      cors: process.env.FRONTEND_URL || "http://localhost:3000",
      category: 'socket'
    });
  }
  private setupMiddleware(): void {
    this.io.use(socketAuthMiddleware);
  }
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }
  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    const username = socket.user!.username;
    Logger.info('[SOCKET] User connected', {
      socketId: socket.id,
      userId,
      username,
      totalConnections: this.io.engine.clientsCount,
      category: 'socket'
    });
    this.addUserConnection(userId, socket.id);
    socket.join(`user:${userId}`);
    this.broadcastUserStatus(userId, username, 'online');
    this.socketController.setupSocketHandlers(socket);
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });
  }
  private handleDisconnection(socket: AuthenticatedSocket, reason: string): void {
    const userId = socket.userId!;
    const username = socket.user!.username;
    Logger.info('[SOCKET] User disconnected', {
      socketId: socket.id,
      userId,
      username,
      reason,
      totalConnections: this.io.engine.clientsCount - 1,
      category: 'socket'
    });
    this.removeUserConnection(userId, socket.id);
    if (!this.isUserOnline(userId)) {
      this.broadcastUserStatus(userId, username, 'offline');
    }
  }
  private addUserConnection(userId: string, socketId: string): void {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);
    this.userSockets.set(socketId, userId);
  }
  private removeUserConnection(userId: string, socketId: string): void {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
      }
    }
    this.userSockets.delete(socketId);
  }
  public isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId) && this.connectedUsers.get(userId)!.size > 0;
  }
  public getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }
  public getUserSocketCount(userId: string): number {
    return this.connectedUsers.get(userId)?.size || 0;
  }
  public broadcastUserStatus(userId: string, username: string, status: 'online' | 'offline'): void {
    const eventName = status === 'online' ? 'user:online' : 'user:offline';
    this.io.emit(eventName, {
      userId,
      username,
      status,
      ...(status === 'offline' && { lastSeen: new Date().toISOString() })
    });
    Logger.info(`[SOCKET] User status broadcasted: ${status}`, {
      userId,
      username,
      status,
      category: 'socket'
    });
  }
  public emitToUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event as any, data);
  }
  public emitToConversation(conversationId: string, event: string, data: any): void {
    this.io.to(`conversation:${conversationId}`).emit(event as any, data);
  }
  public emitToConversationExceptUser(conversationId: string, excludeUserId: string, event: string, data: any): void {
    const room = this.io.sockets.adapter.rooms.get(`conversation:${conversationId}`);
    if (room) {
      room.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId) as AuthenticatedSocket;
        if (socket && socket.userId !== excludeUserId) {
          socket.emit(event, data);
        }
      });
    }
  }
  public getIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
    return this.io;
  }
  public getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }
  public getTotalConnectionsCount(): number {
    return this.io.engine.clientsCount;
  }
}

// Export singleton instance - will be initialized in server.ts
let socketServiceInstance: SocketService | null = null;

export const getSocketService = (): SocketService => {
  if (!socketServiceInstance) {
    throw new Error('SocketService not initialized');
  }
  return socketServiceInstance;
};

export const initializeSocketService = (httpServer: any): SocketService => {
  socketServiceInstance = new SocketService(httpServer);
  return socketServiceInstance;
};
