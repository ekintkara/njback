import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createSocketServer } from '../config/socket';
import { socketAuthMiddleware, AuthenticatedSocket } from '../api/middlewares/socket.middleware';
import Logger from '../utils/logger';

export class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(httpServer: HTTPServer) {
    this.io = createSocketServer(httpServer);
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware(): void {
    this.io.use(socketAuthMiddleware);
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket;
      this.handleConnection(authSocket);
      this.handleDisconnection(authSocket);
      this.handleError(authSocket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket): void {
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
  }

  private handleDisconnection(socket: AuthenticatedSocket): void {
    socket.on('disconnect', (reason: string) => {
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
