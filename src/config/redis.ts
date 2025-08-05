import Redis from 'ioredis';
import Logger from '../utils/logger';
export interface RedisConfig {
  host: string;
  port: number;
  password?: string | undefined;
  db: number;
  keyPrefix: string;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  lazyConnect: boolean;
}
export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'rtm:',
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
};
class RedisClient {
  private static instance: RedisClient;
  private client: Redis;
  private isConnected: boolean = false;
  private constructor() {
    const config: any = {
      host: redisConfig.host,
      port: redisConfig.port,
      db: redisConfig.db,
      keyPrefix: redisConfig.keyPrefix,
      retryDelayOnFailover: redisConfig.retryDelayOnFailover,
      maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
      lazyConnect: redisConfig.lazyConnect
    };
    if (redisConfig.password) {
      config.password = redisConfig.password;
    }
    this.client = new Redis(config);
    this.setupEventHandlers();
  }
  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      Logger.info('Redis connected successfully', {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db
      });
    });
    this.client.on('ready', () => {
      Logger.info('Redis client ready');
    });
    this.client.on('error', (error: Error) => {
      this.isConnected = false;
      Logger.error('Redis connection error', error, {
        host: redisConfig.host,
        port: redisConfig.port
      });
    });
    this.client.on('close', () => {
      this.isConnected = false;
      Logger.warn('Redis connection closed');
    });
    this.client.on('reconnecting', () => {
      Logger.info('Redis reconnecting...');
    });
  }
  public async connect(): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.client.connect();
        Logger.info('Redis connection established');
      }
    } catch (error) {
      Logger.error('Failed to connect to Redis', error as Error);
      throw error;
    }
  }
  public async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
        this.isConnected = false;
        Logger.info('Redis disconnected successfully');
      }
    } catch (error) {
      Logger.error('Error disconnecting from Redis', error as Error);
      throw error;
    }
  }
  public getClient(): Redis {
    return this.client;
  }
  public isClientConnected(): boolean {
    return this.isConnected;
  }
  public async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      Logger.error('Redis ping failed', error as Error);
      throw error;
    }
  }
  public async flushdb(): Promise<string> {
    try {
      return await this.client.flushdb();
    } catch (error) {
      Logger.error('Redis flushdb failed', error as Error);
      throw error;
    }
  }
}
export const redisClient = RedisClient.getInstance();
export default redisClient;
