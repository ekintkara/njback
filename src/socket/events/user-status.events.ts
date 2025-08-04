import { Server as SocketIOServer } from 'socket.io';
import { AuthenticatedSocket } from '../../api/middlewares/socket.middleware';
import { userStatusService } from '../../services/user-status.service';
import Logger from '../../utils/logger';

export interface UserOnlineEvent {
  userId: string;
  username: string;
  timestamp: string;
}

export interface UserOfflineEvent {
  userId: string;
  username: string;
  timestamp: string;
}

export class UserStatusEvents {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  public async handleUserOnline(socket: AuthenticatedSocket): Promise<void> {
    try {
      const { userId, username } = socket.user;
      const timestamp = new Date().toISOString();

      // Set user online in Redis
      await userStatusService.setUserOnline(userId, username);

      // Broadcast to all other users
      const onlineEvent: UserOnlineEvent = {
        userId,
        username,
        timestamp
      };

      socket.broadcast.emit('user_online', onlineEvent);

      Logger.info('User online event broadcasted', {
        userId,
        username,
        timestamp,
        socketId: socket.id
      });

      // Send current online users to the newly connected user
      await this.sendOnlineUsersToSocket(socket);

    } catch (error) {
      Logger.error('Failed to handle user online event', error as Error, {
        userId: socket.user?.userId,
        socketId: socket.id
      });
    }
  }

  public async handleUserOffline(socket: AuthenticatedSocket): Promise<void> {
    try {
      const { userId, username } = socket.user;
      const timestamp = new Date().toISOString();

      // Set user offline in Redis
      await userStatusService.setUserOffline(userId);

      // Broadcast to all other users
      const offlineEvent: UserOfflineEvent = {
        userId,
        username,
        timestamp
      };

      socket.broadcast.emit('user_offline', offlineEvent);

      Logger.info('User offline event broadcasted', {
        userId,
        username,
        timestamp,
        socketId: socket.id
      });

    } catch (error) {
      Logger.error('Failed to handle user offline event', error as Error, {
        userId: socket.user?.userId,
        socketId: socket.id
      });
    }
  }

  public async sendOnlineUsersToSocket(socket: AuthenticatedSocket): Promise<void> {
    try {
      const onlineUsers = await userStatusService.getOnlineUsersWithInfo();
      
      // Filter out the current user from the list
      const otherOnlineUsers = onlineUsers.filter(user => user.userId !== socket.user.userId);

      socket.emit('online_users', {
        users: otherOnlineUsers,
        count: otherOnlineUsers.length,
        timestamp: new Date().toISOString()
      });

      Logger.debug('Online users sent to socket', {
        userId: socket.user.userId,
        socketId: socket.id,
        onlineUsersCount: otherOnlineUsers.length
      });

    } catch (error) {
      Logger.error('Failed to send online users to socket', error as Error, {
        userId: socket.user?.userId,
        socketId: socket.id
      });
    }
  }

  public async broadcastOnlineUserCount(): Promise<void> {
    try {
      const count = await userStatusService.getOnlineUserCount();
      
      this.io.emit('online_user_count', {
        count,
        timestamp: new Date().toISOString()
      });

      Logger.debug('Online user count broadcasted', { count });

    } catch (error) {
      Logger.error('Failed to broadcast online user count', error as Error);
    }
  }

  public async getOnlineUsersForSocket(socket: AuthenticatedSocket): Promise<void> {
    try {
      await this.sendOnlineUsersToSocket(socket);
    } catch (error) {
      Logger.error('Failed to get online users for socket', error as Error, {
        userId: socket.user?.userId,
        socketId: socket.id
      });
      
      socket.emit('error', {
        message: 'Failed to get online users',
        code: 'ONLINE_USERS_ERROR'
      });
    }
  }

  public async handleGetUserStatus(socket: AuthenticatedSocket, data: { userId: string }): Promise<void> {
    try {
      const { userId } = data;
      
      if (!userId) {
        socket.emit('error', {
          message: 'User ID is required',
          code: 'INVALID_USER_ID'
        });
        return;
      }

      const isOnline = await userStatusService.isUserOnline(userId);
      const userInfo = isOnline ? await userStatusService.getUserInfo(userId) : null;

      socket.emit('user_status', {
        userId,
        isOnline,
        userInfo,
        timestamp: new Date().toISOString()
      });

      Logger.debug('User status sent', {
        requesterId: socket.user.userId,
        targetUserId: userId,
        isOnline
      });

    } catch (error) {
      Logger.error('Failed to handle get user status', error as Error, {
        userId: socket.user?.userId,
        socketId: socket.id,
        requestedUserId: data?.userId
      });
      
      socket.emit('error', {
        message: 'Failed to get user status',
        code: 'USER_STATUS_ERROR'
      });
    }
  }
}

export default UserStatusEvents;
