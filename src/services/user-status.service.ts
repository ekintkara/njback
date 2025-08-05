import { redisClient } from '../config/redis';
import Logger from '../utils/logger';
export interface UserStatusInfo {
  userId: string;
  username: string;
  timestamp: string;
}
export class UserStatusService {
  private static instance: UserStatusService;
  private readonly ONLINE_USERS_KEY = 'online_users';
  private readonly USER_INFO_PREFIX = 'user_info:';
  private constructor() {}
  public static getInstance(): UserStatusService {
    if (!UserStatusService.instance) {
      UserStatusService.instance = new UserStatusService();
    }
    return UserStatusService.instance;
  }
  public async setUserOnline(userId: string, username: string): Promise<void> {
    try {
      const redis = redisClient.getClient();
      const timestamp = new Date().toISOString();
      await redis.sadd(this.ONLINE_USERS_KEY, userId);
      const userInfo: UserStatusInfo = {
        userId,
        username,
        timestamp
      };
      await redis.setex(
        `${this.USER_INFO_PREFIX}${userId}`,
        3600, 
        JSON.stringify(userInfo)
      );
      Logger.info('User set online', { userId, username, timestamp });
    } catch (error) {
      Logger.error('Failed to set user online', error as Error, { userId, username });
      throw error;
    }
  }
  public async setUserOffline(userId: string): Promise<void> {
    try {
      const redis = redisClient.getClient();
      await redis.srem(this.ONLINE_USERS_KEY, userId);
      await redis.del(`${this.USER_INFO_PREFIX}${userId}`);
      Logger.info('User set offline', { userId });
    } catch (error) {
      Logger.error('Failed to set user offline', error as Error, { userId });
      throw error;
    }
  }
  public async isUserOnline(userId: string): Promise<boolean> {
    try {
      const redis = redisClient.getClient();
      const result = await redis.sismember(this.ONLINE_USERS_KEY, userId);
      return result === 1;
    } catch (error) {
      Logger.error('Failed to check user online status', error as Error, { userId });
      throw error;
    }
  }
  public async getOnlineUsers(): Promise<string[]> {
    try {
      const redis = redisClient.getClient();
      return await redis.smembers(this.ONLINE_USERS_KEY);
    } catch (error) {
      Logger.error('Failed to get online users', error as Error);
      throw error;
    }
  }
  public async getOnlineUserCount(): Promise<number> {
    try {
      const redis = redisClient.getClient();
      return await redis.scard(this.ONLINE_USERS_KEY);
    } catch (error) {
      Logger.error('Failed to get online user count', error as Error);
      throw error;
    }
  }
  public async getUserInfo(userId: string): Promise<UserStatusInfo | null> {
    try {
      const redis = redisClient.getClient();
      const userInfoStr = await redis.get(`${this.USER_INFO_PREFIX}${userId}`);
      if (!userInfoStr) {
        return null;
      }
      return JSON.parse(userInfoStr) as UserStatusInfo;
    } catch (error) {
      Logger.error('Failed to get user info', error as Error, { userId });
      throw error;
    }
  }
  public async getOnlineUsersWithInfo(): Promise<UserStatusInfo[]> {
    try {
      const onlineUserIds = await this.getOnlineUsers();
      const userInfoPromises = onlineUserIds.map(userId => this.getUserInfo(userId));
      const userInfos = await Promise.all(userInfoPromises);
      return userInfos.filter((info): info is UserStatusInfo => info !== null);
    } catch (error) {
      Logger.error('Failed to get online users with info', error as Error);
      throw error;
    }
  }
  public async cleanupExpiredUsers(): Promise<void> {
    try {
      const redis = redisClient.getClient();
      const onlineUserIds = await this.getOnlineUsers();
      for (const userId of onlineUserIds) {
        const userInfo = await this.getUserInfo(userId);
        if (!userInfo) {
          await redis.srem(this.ONLINE_USERS_KEY, userId);
          Logger.info('Cleaned up expired user from online set', { userId });
        }
      }
    } catch (error) {
      Logger.error('Failed to cleanup expired users', error as Error);
      throw error;
    }
  }
  public async clearAllOnlineUsers(): Promise<void> {
    try {
      const redis = redisClient.getClient();
      const onlineUserIds = await this.getOnlineUsers();
      if (onlineUserIds.length > 0) {
        const userInfoKeys = onlineUserIds.map(userId => `${this.USER_INFO_PREFIX}${userId}`);
        await redis.del(...userInfoKeys);
      }
      await redis.del(this.ONLINE_USERS_KEY);
      Logger.info('Cleared all online users', { count: onlineUserIds.length });
    } catch (error) {
      Logger.error('Failed to clear all online users', error as Error);
      throw error;
    }
  }
}
export const userStatusService = UserStatusService.getInstance();
export default userStatusService;
