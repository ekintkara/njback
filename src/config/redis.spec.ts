import { RedisMemoryServer } from 'redis-memory-server';
import { redisConfig } from './redis';
jest.mock('../utils/logger');
describe('Redis Configuration', () => {
  let redisServer: RedisMemoryServer;
  beforeAll(async () => {
    redisServer = new RedisMemoryServer();
  });
  afterAll(async () => {
    await redisServer.stop();
  });
  describe('redisConfig', () => {
    it('should have default configuration values', () => {
      expect(redisConfig).toMatchObject({
        host: 'localhost',
        port: 6379,
        db: 0,
        keyPrefix: 'rtm:',
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });
    });
    it('should use environment variables when available', () => {
      const originalEnv = process.env;
      process.env = {
        ...originalEnv,
        REDIS_HOST: 'test-host',
        REDIS_PORT: '6380',
        REDIS_PASSWORD: 'test-password',
        REDIS_DB: '1',
        REDIS_KEY_PREFIX: 'test:'
      };
      jest.resetModules();
      const { redisConfig: updatedConfig } = require('./redis');
      expect(updatedConfig.host).toBe('test-host');
      expect(updatedConfig.port).toBe(6380);
      expect(updatedConfig.password).toBe('test-password');
      expect(updatedConfig.db).toBe(1);
      expect(updatedConfig.keyPrefix).toBe('test:');
      process.env = originalEnv;
    });
  });
  describe('RedisClient', () => {
    it('should be a singleton', async () => {
      const { redisClient } = await import('./redis');
      const { redisClient: redisClient2 } = await import('./redis');
      expect(redisClient).toBe(redisClient2);
    });
    it('should provide client instance', async () => {
      const { redisClient } = await import('./redis');
      const client = redisClient.getClient();
      expect(client).toBeDefined();
      expect(typeof client.ping).toBe('function');
    });
    it('should handle connection status', async () => {
      const { redisClient } = await import('./redis');
      expect(redisClient.isClientConnected()).toBe(false);
    });
  });
});
