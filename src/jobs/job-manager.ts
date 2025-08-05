import { MessagePlanningJob } from './message-planning.job';
import { QueueManagerJob } from './queue-manager.job';
import Logger from '../utils/logger';
export class JobManager {
  private messagePlanningJob: MessagePlanningJob;
  private queueManagerJob: QueueManagerJob;
  private isInitialized: boolean = false;
  constructor() {
    this.messagePlanningJob = new MessagePlanningJob();
    this.queueManagerJob = new QueueManagerJob();
  }
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      Logger.warn('[JOB_MANAGER] Job manager already initialized', {
        category: 'job-manager'
      });
      return;
    }
    try {
      Logger.info('[JOB_MANAGER] Initializing job manager and starting cron jobs', {
        category: 'job-manager'
      });
      this.messagePlanningJob.start();
      this.queueManagerJob.start();
      this.isInitialized = true;
      Logger.info('[JOB_MANAGER] Job manager initialized successfully', {
        jobs: ['message-planning', 'queue-manager'],
        category: 'job-manager'
      });
    } catch (error) {
      Logger.error('[JOB_MANAGER] Failed to initialize job manager', error as Error, {
        category: 'job-manager'
      });
      throw error;
    }
  }
  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      Logger.warn('[JOB_MANAGER] Job manager not initialized, nothing to shutdown', {
        category: 'job-manager'
      });
      return;
    }
    try {
      Logger.info('[JOB_MANAGER] Shutting down job manager and stopping cron jobs', {
        category: 'job-manager'
      });
      this.messagePlanningJob.stop();
      this.queueManagerJob.stop();
      this.isInitialized = false;
      Logger.info('[JOB_MANAGER] Job manager shutdown completed', {
        category: 'job-manager'
      });
    } catch (error) {
      Logger.error('[JOB_MANAGER] Error during job manager shutdown', error as Error, {
        category: 'job-manager'
      });
      throw error;
    }
  }
  public getJobsStatus(): {
    isInitialized: boolean;
    messagePlanningJob: {
      isScheduled: boolean;
      isRunning: boolean;
      nextExecution: string | null;
    };
    queueManagerJob: {
      isRunning: boolean;
      lastExecution: Date | null;
      nextExecution: Date | null;
      totalProcessed: number;
      totalQueued: number;
      totalErrors: number;
    };
  } {
    return {
      isInitialized: this.isInitialized,
      messagePlanningJob: this.messagePlanningJob.getStatus(),
      queueManagerJob: this.queueManagerJob.getStatus()
    };
  }
  public async triggerMessagePlanningJob(): Promise<number> {
    Logger.info('[JOB_MANAGER] Manually triggering message planning job', {
      category: 'job-manager'
    });
    try {
      const result = await this.messagePlanningJob.executeManually();
      Logger.info('[JOB_MANAGER] Message planning job triggered successfully', {
        result,
        category: 'job-manager'
      });
      return result;
    } catch (error) {
      Logger.error('[JOB_MANAGER] Failed to trigger message planning job', error as Error, {
        category: 'job-manager'
      });
      throw error;
    }
  }
  public async triggerQueueManagerJob(): Promise<number> {
    Logger.info('[JOB_MANAGER] Manually triggering queue manager job', {
      category: 'job-manager'
    });
    try {
      const result = await this.queueManagerJob.executeManually();
      Logger.info('[JOB_MANAGER] Queue manager job triggered successfully', {
        result,
        category: 'job-manager'
      });
      return result;
    } catch (error) {
      Logger.error('[JOB_MANAGER] Failed to trigger queue manager job', error as Error, {
        category: 'job-manager'
      });
      throw error;
    }
  }
  public isJobManagerInitialized(): boolean {
    return this.isInitialized;
  }
}
export const jobManager = new JobManager();
