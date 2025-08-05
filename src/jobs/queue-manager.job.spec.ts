import { QueueManagerJob } from './queue-manager.job';
import { queueService } from '../services/queue.service';
jest.mock('../services/queue.service');
jest.mock('../utils/logger');
jest.mock('node-cron');
const mockQueueService = queueService as jest.Mocked<typeof queueService>;
describe('QueueManagerJob', () => {
  let queueManagerJob: QueueManagerJob;
  beforeEach(() => {
    queueManagerJob = new QueueManagerJob();
    jest.clearAllMocks();
  });
  describe('executeManually', () => {
    it('should execute job manually and return processed count', async () => {
      const mockResult = {
        processed: 5,
        queued: 5,
        failed: 0,
        errors: []
      };
      mockQueueService.processPendingMessages.mockResolvedValue(mockResult);
      const result = await queueManagerJob.executeManually();
      expect(mockQueueService.processPendingMessages).toHaveBeenCalled();
      expect(result).toBe(5); 
    });
    it('should handle execution errors', async () => {
      mockQueueService.processPendingMessages.mockRejectedValue(new Error('Processing error'));
      await queueManagerJob.executeManually();
      expect(mockQueueService.processPendingMessages).toHaveBeenCalled();
    });
    it('should skip execution if already running', async () => {
      const promise1 = queueManagerJob.executeManually();
      const promise2 = queueManagerJob.executeManually();
      mockQueueService.processPendingMessages.mockResolvedValue({
        processed: 1,
        queued: 1,
        failed: 0,
        errors: []
      });
      await Promise.all([promise1, promise2]);
      expect(mockQueueService.processPendingMessages).toHaveBeenCalledTimes(1);
    });
  });
  describe('getStatus', () => {
    it('should return correct initial status', () => {
      const status = queueManagerJob.getStatus();
      expect(status).toEqual({
        isRunning: false,
        lastExecution: null,
        nextExecution: null,
        totalProcessed: 0,
        totalQueued: 0,
        totalErrors: 0
      });
    });
    it('should update status after execution', async () => {
      const mockResult = {
        processed: 3,
        queued: 2,
        failed: 1,
        errors: ['Error message']
      };
      mockQueueService.processPendingMessages.mockResolvedValue(mockResult);
      await queueManagerJob.executeManually();
      const status = queueManagerJob.getStatus();
      expect(status.totalProcessed).toBe(3);
      expect(status.totalQueued).toBe(2);
      expect(status.totalErrors).toBe(1);
      expect(status.lastExecution).toBeInstanceOf(Date);
    });
  });
  describe('isJobRunning', () => {
    it('should return false initially', () => {
      expect(queueManagerJob.isJobRunning()).toBe(false);
    });
    it('should return true during execution', async () => {
      let isRunningDuringExecution = false;
      mockQueueService.processPendingMessages.mockImplementation(async () => {
        isRunningDuringExecution = queueManagerJob.isJobRunning();
        return {
          processed: 1,
          queued: 1,
          failed: 0,
          errors: []
        };
      });
      await queueManagerJob.executeManually();
      expect(isRunningDuringExecution).toBe(true);
      expect(queueManagerJob.isJobRunning()).toBe(false); 
    });
  });
  describe('resetStats', () => {
    it('should reset all statistics', async () => {
      mockQueueService.processPendingMessages.mockResolvedValue({
        processed: 5,
        queued: 4,
        failed: 1,
        errors: ['Error']
      });
      await queueManagerJob.executeManually();
      let status = queueManagerJob.getStatus();
      expect(status.totalProcessed).toBe(5);
      expect(status.totalQueued).toBe(4);
      expect(status.totalErrors).toBe(1);
      queueManagerJob.resetStats();
      status = queueManagerJob.getStatus();
      expect(status.totalProcessed).toBe(0);
      expect(status.totalQueued).toBe(0);
      expect(status.totalErrors).toBe(0);
      expect(status.lastExecution).toBeNull();
    });
  });
  describe('getQueueStats', () => {
    it('should return queue statistics from service', async () => {
      const mockStats = {
        pendingCount: 10,
        queuedCount: 5,
        sentCount: 20
      };
      mockQueueService.getQueueStats.mockResolvedValue(mockStats);
      const stats = await queueManagerJob.getQueueStats();
      expect(stats).toEqual(mockStats);
      expect(mockQueueService.getQueueStats).toHaveBeenCalled();
    });
    it('should handle service errors', async () => {
      mockQueueService.getQueueStats.mockRejectedValue(new Error('Service error'));
      await expect(queueManagerJob.getQueueStats()).rejects.toThrow('Service error');
    });
  });
  describe('start and stop', () => {
    it('should start and stop cron job', () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      const cron = require('node-cron');
      cron.schedule = jest.fn().mockReturnValue(mockTask);
      queueManagerJob.start();
      expect(cron.schedule).toHaveBeenCalledWith(
        '* * * * *',
        expect.any(Function),
        {
          scheduled: false,
          timezone: 'Europe/Istanbul'
        }
      );
      expect(mockTask.start).toHaveBeenCalled();
      queueManagerJob.stop();
      expect(mockTask.stop).toHaveBeenCalled();
    });
    it('should not start if already started', () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      const cron = require('node-cron');
      cron.schedule = jest.fn().mockReturnValue(mockTask);
      queueManagerJob.start();
      queueManagerJob.start(); 
      expect(cron.schedule).toHaveBeenCalledTimes(1);
    });
  });
});
