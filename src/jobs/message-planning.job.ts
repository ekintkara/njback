import * as cron from 'node-cron';
import { AutoMessageService } from '../services/auto-message.service';
import Logger from '../utils/logger';
export class MessagePlanningJob {
  private autoMessageService: AutoMessageService;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;
  constructor() {
    this.autoMessageService = new AutoMessageService();
  }
  private async executeJob(): Promise<void> {
    if (this.isRunning) {
      Logger.warn('[MESSAGE_PLANNING_JOB] Job already running, skipping execution', {
        category: 'cron-job'
      });
      return;
    }
    this.isRunning = true;
    const startTime = Date.now();
    try {
      Logger.info('[MESSAGE_PLANNING_JOB] Starting nightly message planning job', {
        timestamp: new Date().toISOString(),
        category: 'cron-job'
      });
      const messagesPlanned = await this.autoMessageService.planAutomaticMessages();
      const executionTime = Date.now() - startTime;
      Logger.info('[MESSAGE_PLANNING_JOB] Nightly message planning job completed successfully', {
        messagesPlanned,
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString(),
        category: 'cron-job'
      });
    } catch (error) {
      const executionTime = Date.now() - startTime;
      Logger.error('[MESSAGE_PLANNING_JOB] Nightly message planning job failed', error as Error, {
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
      Logger.warn('[MESSAGE_PLANNING_JOB] Cron job already started', {
        category: 'cron-job'
      });
      return;
    }
    try {
      this.cronJob = cron.schedule('0 2 * * *', async () => {
        await this.executeJob();
      }, {
        scheduled: false, 
        timezone: 'Europe/Istanbul'
      });
      this.cronJob.start();
      Logger.info('[MESSAGE_PLANNING_JOB] Nightly message planning cron job started', {
        schedule: '0 2 * * *',
        timezone: 'Europe/Istanbul',
        nextExecution: this.getNextExecutionTime(),
        category: 'cron-job'
      });
    } catch (error) {
      Logger.error('[MESSAGE_PLANNING_JOB] Failed to start cron job', error as Error, {
        category: 'cron-job'
      });
      throw error;
    }
  }
  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      Logger.info('[MESSAGE_PLANNING_JOB] Nightly message planning cron job stopped', {
        category: 'cron-job'
      });
    }
  }
  private getNextExecutionTime(): string {
    const now = new Date();
    const next = new Date(now);
    next.setHours(2, 0, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  }
  public isJobRunning(): boolean {
    return this.isRunning;
  }
  public getStatus(): {
    isScheduled: boolean;
    isRunning: boolean;
    nextExecution: string | null;
  } {
    return {
      isScheduled: this.cronJob !== null,
      isRunning: this.isRunning,
      nextExecution: this.cronJob ? this.getNextExecutionTime() : null
    };
  }
  public async executeManually(): Promise<number> {
    Logger.info('[MESSAGE_PLANNING_JOB] Manual execution triggered', {
      category: 'cron-job'
    });
    await this.executeJob();
    return 0;
  }
}
