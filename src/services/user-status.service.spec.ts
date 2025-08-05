import { RedisMemoryServer } from 'redis-memory-server';
import Redis from 'ioredis';
import { UserStatusService } from './user-status.service';
jest.mock('../utils/logger');
describe('UserStatusService', () => {
  let redisServer: RedisMemoryServer;
  let redis: Redis;
  let userStatusService: UserStatusService;
  beforeAll(async () => {
    redisServer = new RedisMemoryServer();
    const host = await redisServer.getHost();
    const port = await redisServer.getPort();
    redis = new Redis({
      host,
      port,
      maxRetriesPerRequest: 1
    });
    const mockRedisClient = {
      getClient: () => redis,
      isClientConnected: () => true
    };
    jest.doMock('../config/redis', () => ({
      redisClient: mockRedisClient
    }));
    const { UserStatusService: MockedUserStatusService } = await import('./user-status.service');
    userStatusService = MockedUserStatusService.getInstance();
  });
  afterAll(async () => {
    await redis.disconnect();
    await redisServer.stop();
  });
  beforeEach(async () => {
    await redis.flushall();
  });
  describe('setUserOnline', () => {
    it('should set user online in Redis', async () => {
      const userId = 'user123';
      const username = 'testuser';
      await userStatusService.setUserOnline(userId, username);
      const isOnline = await userStatusService.isUserOnline(userId);
      expect(isOnline).toBe(true);
      const userInfo = await userStatusService.getUserInfo(userId);
      expect(userInfo).toMatchObject({
        userId,
        username
      });
      expect(userInfo?.timestamp).toBeDefined();
    });
    it('should handle multiple users online', async () => {
      await userStatusService.setUserOnline('user1', 'testuser1');
      await userStatusService.setUserOnline('user2', 'testuser2');
      const onlineUsers = await userStatusService.getOnlineUsers();
      expect(onlineUsers).toHaveLength(2);
      expect(onlineUsers).toContain('user1');
      expect(onlineUsers).toContain('user2');
      const count = await userStatusService.getOnlineUserCount();
      expect(count).toBe(2);
    });
  });
  describe('setUserOffline', () => {
    it('should set user offline in Redis', async () => {
      const userId = 'user123';
      const username = 'testuser';
      await userStatusService.setUserOnline(userId, username);
      expect(await userStatusService.isUserOnline(userId)).toBe(true);
      await userStatusService.setUserOffline(userId);
      expect(await userStatusService.isUserOnline(userId)).toBe(false);
      const userInfo = await userStatusService.getUserInfo(userId);
      expect(userInfo).toBeNull();
    });
  });
  describe('isUserOnline', () => {
    it('should return true for online user', async () => {
      const userId = 'user123';
      await userStatusService.setUserOnline(userId, 'testuser');
      const isOnline = await userStatusService.isUserOnline(userId);
      expect(isOnline).toBe(true);
    });
    it('should return false for offline user', async () => {
      const userId = 'user123';
      const isOnline = await userStatusService.isUserOnline(userId);
      expect(isOnline).toBe(false);
    });
  });
  describe('getOnlineUsers', () => {
    it('should return empty array when no users online', async () => {
      const onlineUsers = await userStatusService.getOnlineUsers();
      expect(onlineUsers).toEqual([]);
    });
    it('should return all online users', async () => {
      await userStatusService.setUserOnline('user1', 'testuser1');
      await userStatusService.setUserOnline('user2', 'testuser2');
      await userStatusService.setUserOnline('user3', 'testuser3');
      const onlineUsers = await userStatusService.getOnlineUsers();
      expect(onlineUsers).toHaveLength(3);
      expect(onlineUsers).toContain('user1');
      expect(onlineUsers).toContain('user2');
      expect(onlineUsers).toContain('user3');
    });
  });
  describe('getOnlineUserCount', () => {
    it('should return 0 when no users online', async () => {
      const count = await userStatusService.getOnlineUserCount();
      expect(count).toBe(0);
    });
    it('should return correct count of online users', async () => {
      await userStatusService.setUserOnline('user1', 'testuser1');
      await userStatusService.setUserOnline('user2', 'testuser2');
      const count = await userStatusService.getOnlineUserCount();
      expect(count).toBe(2);
    });
  });
  describe('getOnlineUsersWithInfo', () => {
    it('should return users with their info', async () => {
      await userStatusService.setUserOnline('user1', 'testuser1');
      await userStatusService.setUserOnline('user2', 'testuser2');
      const usersWithInfo = await userStatusService.getOnlineUsersWithInfo();
      expect(usersWithInfo).toHaveLength(2);
      const user1Info = usersWithInfo.find(u => u.userId === 'user1');
      expect(user1Info).toMatchObject({
        userId: 'user1',
        username: 'testuser1'
      });
      const user2Info = usersWithInfo.find(u => u.userId === 'user2');
      expect(user2Info).toMatchObject({
        userId: 'user2',
        username: 'testuser2'
      });
    });
  });
  describe('clearAllOnlineUsers', () => {
    it('should clear all online users', async () => {
      await userStatusService.setUserOnline('user1', 'testuser1');
      await userStatusService.setUserOnline('user2', 'testuser2');
      expect(await userStatusService.getOnlineUserCount()).toBe(2);
      await userStatusService.clearAllOnlineUsers();
      expect(await userStatusService.getOnlineUserCount()).toBe(0);
      expect(await userStatusService.getOnlineUsers()).toEqual([]);
    });
  });
});
