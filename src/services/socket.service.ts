import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createSocketServer } from '../config/socket';
import { socketAuthMiddleware, AuthenticatedSocket } from '../api/middlewares/socket.middleware';
import { UserStatusEvents } from '../socket/events/user-status.events';
import { redisClient } from '../config/redis';
import Logger from '../utils/logger';

export class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId
  private userStatusEvents: UserStatusEvents;

  constructor(httpServer: HTTPServer) {
    this.io = createSocketServer(httpServer);
    this.userStatusEvents = new UserStatusEvents(this.io);
    this.setupMiddleware();
    this.setupEventHandlers();
    this.initializeRedis();
  }

  private setupMiddleware(): void {
    this.io.use(socketAuthMiddleware);
  }

  private async initializeRedis(): Promise<void> {
    try {
      await redisClient.connect();
      Logger.info('Redis connected for Socket.IO service');
    } catch (error) {
      Logger.error('Failed to connect Redis for Socket.IO service', error as Error);
    }
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket;
      this.handleConnection(authSocket);
      this.handleDisconnection(authSocket);
      this.handleError(authSocket);
      this.handleUserStatusEvents(authSocket);
    });
  }

  private async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    const { userId, username } = socket.user;

    // Store user connection
    this.connectedUsers.set(userId, socket.id);

    Logger.info('User connected to Socket.IO', {
      socketId: socket.id,
      userId,
      username,
      totalConnections: this.connectedUsers.size
    });

    // Send connection confirmation to user
    socket.emit('connected', {
      message: 'Successfully connected to real-time messaging',
      userId,
      username
    });
    await this.userStatusEvents.handleUserOnline(socket);
  }

  private handleDisconnection(socket: AuthenticatedSocket): void {
    socket.on('disconnect', async (reason: string) => {
      const { userId, username } = socket.user;

      // Remove user connection
      this.connectedUsers.delete(userId);

      Logger.info('User disconnected from Socket.IO', {
        socketId: socket.id,
        userId,
        username,
        reason,
        totalConnections: this.connectedUsers.size
      });

      await this.userStatusEvents.handleUserOffline(socket);
    });
  }

  private handleError(socket: AuthenticatedSocket): void {
    socket.on('error', (error: Error) => {
      Logger.error('Socket.IO error', error, {
        socketId: socket.id,
        userId: socket.user?.userId,
        username: socket.user?.username
      });
    });
  }

  private handleUserStatusEvents(socket: AuthenticatedSocket): void {
    socket.on('get_online_users', async () => {
      await this.userStatusEvents.getOnlineUsersForSocket(socket);
    });

    socket.on('get_user_status', async (data: { userId: string }) => {
      await this.userStatusEvents.handleGetUserStatus(socket, data);
    });
  }

  public getConnectedUsers(): Map<string, string> {
    return this.connectedUsers;
  }

  public getConnectedUserCount(): number {
    return this.connectedUsers.size;
  }

  public isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getSocketByUserId(userId: string): string | undefined {
    return this.connectedUsers.get(userId);
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

export default SocketService;
