import * as cron from 'node-cron';
import { queueService } from '../services/queue.service';
import { QueueJobStatus } from '../types/queue.types';
import Logger from '../utils/logger';
export class QueueManagerJob {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;
  private lastExecution: Date | null = null;
  private totalProcessed: number = 0;
  private totalQueued: number = 0;
  private totalErrors: number = 0;
  constructor() {}
  private async executeJob(): Promise<void> {
    if (this.isRunning) {
      Logger.warn('[QUEUE_MANAGER_JOB] Job already running, skipping execution', {
        category: 'cron-job'
      });
      return;
    }
    this.isRunning = true;
    const startTime = Date.now();
    try {
      Logger.info('[QUEUE_MANAGER_JOB] Starting queue management job', {
        timestamp: new Date().toISOString(),
        category: 'cron-job'
      });
      const result = await queueService.processPendingMessages();
      const executionTime = Date.now() - startTime;
      this.lastExecution = new Date();
      this.totalProcessed += result.processed;
      this.totalQueued += result.queued;
      this.totalErrors += result.failed;
      Logger.info('[QUEUE_MANAGER_JOB] Queue management job completed successfully', {
        processed: result.processed,
        queued: result.queued,
        failed: result.failed,
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString(),
        category: 'cron-job'
      });
      if (result.errors.length > 0) {
        Logger.warn('[QUEUE_MANAGER_JOB] Job completed with errors', {
          errorCount: result.errors.length,
          errors: result.errors,
          category: 'cron-job'
        });
      }
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.totalErrors++;
      Logger.error('[QUEUE_MANAGER_JOB] Queue management job failed', error as Error, {
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString(),
        category: 'cron-job'
      });
    } finally {
      this.isRunning = false;
    }
  }
  public start(): void {
    if (this.cronJob) {
      Logger.warn('[QUEUE_MANAGER_JOB] Cron job already started', {
        category: 'cron-job'
      });
      return;
    }
    try {
      this.cronJob = cron.schedule('* * * * *', async () => {
        await this.executeJob();
      }, {
        scheduled: false, 
        timezone: 'Europe/Istanbul'
      });
      this.cronJob.start();
      Logger.info('[QUEUE_MANAGER_JOB] Queue management cron job started', {
        schedule: '* * * * *',
        timezone: 'Europe/Istanbul',
        nextExecution: this.getNextExecutionTime(),
        category: 'cron-job'
      });
    } catch (error) {
      Logger.error('[QUEUE_MANAGER_JOB] Failed to start cron job', error as Error, {
        category: 'cron-job'
      });
      throw error;
    }
  }
  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      Logger.info('[QUEUE_MANAGER_JOB] Queue management cron job stopped', {
        category: 'cron-job'
      });
    }
  }
  private getNextExecutionTime(): string {
    const now = new Date();
    const next = new Date(now);
    next.setMinutes(next.getMinutes() + 1);
    next.setSeconds(0);
    next.setMilliseconds(0);
    return next.toISOString();
  }
  public isJobRunning(): boolean {
    return this.isRunning;
  }
  public getStatus(): QueueJobStatus {
    return {
      isRunning: this.isRunning,
      lastExecution: this.lastExecution,
      nextExecution: this.cronJob ? new Date(this.getNextExecutionTime()) : null,
      totalProcessed: this.totalProcessed,
      totalQueued: this.totalQueued,
      totalErrors: this.totalErrors
    };
  }
  public async executeManually(): Promise<number> {
    Logger.info('[QUEUE_MANAGER_JOB] Manual execution triggered', {
      category: 'cron-job'
    });
    await this.executeJob();
    return this.totalProcessed;
  }
  public resetStats(): void {
    this.totalProcessed = 0;
    this.totalQueued = 0;
    this.totalErrors = 0;
    this.lastExecution = null;
    Logger.info('[QUEUE_MANAGER_JOB] Job statistics reset', {
      category: 'cron-job'
    });
  }
  public async getQueueStats(): Promise<{
    pendingCount: number;
    queuedCount: number;
    sentCount: number;
  }> {
    try {
      return await queueService.getQueueStats();
    } catch (error) {
      Logger.error('[QUEUE_MANAGER_JOB] Failed to get queue stats', error as Error, {
        category: 'cron-job'
      });
      throw error;
    }
  }
}
