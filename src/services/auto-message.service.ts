import { Types } from 'mongoose';
import User from '../models/user.model';
import AutoMessage, { IAutoMessage } from '../models/auto-message.model';
import { getRandomMessageTemplate } from '../constants/message-templates';
import { AppError } from '../utils/app-error';
import Logger from '../utils/logger';
export interface UserPair {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
}
export interface AutoMessageData {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  content: string;
  sendDate: Date;
}
export class AutoMessageService {
  public async getActiveUsers(): Promise<any[]> {
    try {
      const activeUsers = await User.find({ isActive: true })
        .select('_id username email')
        .lean();
      Logger.info('[AUTO_MESSAGE_SERVICE] Active users retrieved', {
        count: activeUsers.length,
        category: 'auto-message'
      });
      return activeUsers;
    } catch (error) {
      Logger.error('[AUTO_MESSAGE_SERVICE] Error retrieving active users', error as Error, {
        category: 'auto-message'
      });
      throw new AppError('Failed to retrieve active users', 500, 'USER_RETRIEVAL_FAILED');
    }
  }
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  public createUserPairs(users: any[]): UserPair[] {
    if (users.length < 2) {
      Logger.warn('[AUTO_MESSAGE_SERVICE] Not enough users for pairing', {
        userCount: users.length,
        category: 'auto-message'
      });
      return [];
    }
    const shuffledUsers = this.shuffleArray(users);
    const pairs: UserPair[] = [];
    for (let i = 0; i < shuffledUsers.length - 1; i += 2) {
      pairs.push({
        senderId: shuffledUsers[i]._id,
        receiverId: shuffledUsers[i + 1]._id
      });
    }
    Logger.info('[AUTO_MESSAGE_SERVICE] User pairs created', {
      totalUsers: users.length,
      pairsCreated: pairs.length,
      skippedUsers: users.length % 2,
      category: 'auto-message'
    });
    return pairs;
  }
  private generateRandomSendDate(): Date {
    const now = new Date();
    const hoursToAdd = Math.floor(Math.random() * 24) + 1;
    const minutesToAdd = Math.floor(Math.random() * 60);
    const sendDate = new Date(now);
    sendDate.setHours(sendDate.getHours() + hoursToAdd);
    sendDate.setMinutes(sendDate.getMinutes() + minutesToAdd);
    return sendDate;
  }
  public createAutoMessageData(pairs: UserPair[]): AutoMessageData[] {
    const autoMessages: AutoMessageData[] = [];
    for (const pair of pairs) {
      const messageData: AutoMessageData = {
        senderId: pair.senderId,
        receiverId: pair.receiverId,
        content: getRandomMessageTemplate(),
        sendDate: this.generateRandomSendDate()
      };
      autoMessages.push(messageData);
    }
    Logger.info('[AUTO_MESSAGE_SERVICE] Auto message data created', {
      messagesCreated: autoMessages.length,
      category: 'auto-message'
    });
    return autoMessages;
  }
  public async saveAutoMessages(autoMessages: AutoMessageData[]): Promise<IAutoMessage[]> {
    try {
      if (autoMessages.length === 0) {
        Logger.warn('[AUTO_MESSAGE_SERVICE] No auto messages to save', {
          category: 'auto-message'
        });
        return [];
      }
      const savedMessages = await AutoMessage.insertMany(autoMessages);
      Logger.info('[AUTO_MESSAGE_SERVICE] Auto messages saved to database', {
        savedCount: savedMessages.length,
        category: 'auto-message'
      });
      return savedMessages;
    } catch (error) {
      Logger.error('[AUTO_MESSAGE_SERVICE] Error saving auto messages', error as Error, {
        messageCount: autoMessages.length,
        category: 'auto-message'
      });
      throw new AppError('Failed to save auto messages', 500, 'AUTO_MESSAGE_SAVE_FAILED');
    }
  }
  public async planAutomaticMessages(): Promise<number> {
    try {
      Logger.info('[AUTO_MESSAGE_SERVICE] Starting automatic message planning', {
        timestamp: new Date().toISOString(),
        category: 'auto-message'
      });
      const activeUsers = await this.getActiveUsers();
      if (activeUsers.length < 2) {
        Logger.warn('[AUTO_MESSAGE_SERVICE] Not enough active users for message planning', {
          userCount: activeUsers.length,
          category: 'auto-message'
        });
        return 0;
      }
      const userPairs = this.createUserPairs(activeUsers);
      if (userPairs.length === 0) {
        Logger.warn('[AUTO_MESSAGE_SERVICE] No user pairs created', {
          category: 'auto-message'
        });
        return 0;
      }
      const autoMessageData = this.createAutoMessageData(userPairs);
      const savedMessages = await this.saveAutoMessages(autoMessageData);
      Logger.info('[AUTO_MESSAGE_SERVICE] Automatic message planning completed successfully', {
        totalUsers: activeUsers.length,
        pairsCreated: userPairs.length,
        messagesPlanned: savedMessages.length,
        category: 'auto-message'
      });
      return savedMessages.length;
    } catch (error) {
      Logger.error('[AUTO_MESSAGE_SERVICE] Error in automatic message planning', error as Error, {
        category: 'auto-message'
      });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Automatic message planning failed', 500, 'MESSAGE_PLANNING_FAILED');
    }
  }
}
