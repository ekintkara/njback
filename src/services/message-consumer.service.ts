import { Types } from 'mongoose';
import Message from '../models/message.model';
import Conversation from '../models/conversation.model';
import AutoMessage from '../models/auto-message.model';
import User from '../models/user.model';
import { QueueMessageData } from '../types/queue.types';
import { AppError } from '../utils/app-error';
import Logger from '../utils/logger';
export interface MessageProcessingResult {
  success: boolean;
  messageId?: string;
  conversationId?: string;
  error?: string;
}
export interface AutoMessageNotification {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderInfo: {
    _id: string;
    username: string;
    email: string;
  };
  content: string;
  createdAt: string;
  isAutoMessage: true;
}
export class MessageConsumerService {
  private static instance: MessageConsumerService;
  private constructor() {}
  public static getInstance(): MessageConsumerService {
    if (!MessageConsumerService.instance) {
      MessageConsumerService.instance = new MessageConsumerService();
    }
    return MessageConsumerService.instance;
  }
  public async processQueueMessage(queueMessage: QueueMessageData): Promise<MessageProcessingResult> {
    try {
      Logger.info('[MESSAGE_CONSUMER] Processing queue message', {
        autoMessageId: queueMessage.autoMessageId,
        senderId: queueMessage.senderId,
        receiverId: queueMessage.receiverId,
        category: 'message-consumer'
      });
      this.validateQueueMessage(queueMessage);
      await this.validateUsers(queueMessage.senderId, queueMessage.receiverId);
      const conversationId = await this.createOrFindConversation(
        queueMessage.senderId,
        queueMessage.receiverId
      );
      const message = await this.createMessage(
        conversationId,
        queueMessage.senderId,
        queueMessage.content
      );
      await this.updateAutoMessageStatus(queueMessage.autoMessageId);
      Logger.info('[MESSAGE_CONSUMER] Queue message processed successfully', {
        autoMessageId: queueMessage.autoMessageId,
        messageId: message._id.toString(),
        conversationId: conversationId.toString(),
        category: 'message-consumer'
      });
      return {
        success: true,
        messageId: message._id.toString(),
        conversationId: conversationId.toString()
      };
    } catch (error) {
      Logger.error('[MESSAGE_CONSUMER] Failed to process queue message', error as Error, {
        autoMessageId: queueMessage.autoMessageId,
        category: 'message-consumer'
      });
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
  private validateQueueMessage(queueMessage: QueueMessageData): void {
    if (!queueMessage.autoMessageId || !Types.ObjectId.isValid(queueMessage.autoMessageId)) {
      throw new AppError('Invalid autoMessageId', 400, 'INVALID_AUTO_MESSAGE_ID');
    }
    if (!queueMessage.senderId || !Types.ObjectId.isValid(queueMessage.senderId)) {
      throw new AppError('Invalid senderId', 400, 'INVALID_SENDER_ID');
    }
    if (!queueMessage.receiverId || !Types.ObjectId.isValid(queueMessage.receiverId)) {
      throw new AppError('Invalid receiverId', 400, 'INVALID_RECEIVER_ID');
    }
    if (!queueMessage.content || queueMessage.content.trim().length === 0) {
      throw new AppError('Message content is required', 400, 'EMPTY_CONTENT');
    }
    if (queueMessage.content.length > 1000) {
      throw new AppError('Message content too long', 400, 'CONTENT_TOO_LONG');
    }
    if (queueMessage.senderId === queueMessage.receiverId) {
      throw new AppError('Sender and receiver cannot be the same', 400, 'SAME_SENDER_RECEIVER');
    }
  }
  private async validateUsers(senderId: string, receiverId: string): Promise<void> {
    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId)
    ]);
    if (!sender) {
      throw new AppError('Sender user not found', 404, 'SENDER_NOT_FOUND');
    }
    if (!receiver) {
      throw new AppError('Receiver user not found', 404, 'RECEIVER_NOT_FOUND');
    }
    if (!sender.isActive) {
      throw new AppError('Sender user is not active', 400, 'SENDER_INACTIVE');
    }
    if (!receiver.isActive) {
      throw new AppError('Receiver user is not active', 400, 'RECEIVER_INACTIVE');
    }
  }
  private async createOrFindConversation(senderId: string, receiverId: string): Promise<Types.ObjectId> {
    try {
      const existingConversation = await Conversation.findOne({
        participants: {
          $all: [
            new Types.ObjectId(senderId),
            new Types.ObjectId(receiverId)
          ]
        }
      });
      if (existingConversation) {
        Logger.debug('[MESSAGE_CONSUMER] Using existing conversation', {
          conversationId: existingConversation._id.toString(),
          senderId,
          receiverId,
          category: 'message-consumer'
        });
        return existingConversation._id;
      }
      const newConversation = new Conversation({
        participants: [
          new Types.ObjectId(senderId),
          new Types.ObjectId(receiverId)
        ]
      });
      await newConversation.save();
      Logger.info('[MESSAGE_CONSUMER] Created new conversation', {
        conversationId: newConversation._id.toString(),
        senderId,
        receiverId,
        category: 'message-consumer'
      });
      return newConversation._id;
    } catch (error) {
      Logger.error('[MESSAGE_CONSUMER] Failed to create/find conversation', error as Error, {
        senderId,
        receiverId,
        category: 'message-consumer'
      });
      throw error;
    }
  }
  private async createMessage(
    conversationId: Types.ObjectId,
    senderId: string,
    content: string
  ): Promise<any> {
    try {
      const message = new Message({
        conversationId,
        senderId: new Types.ObjectId(senderId),
        content: content.trim(),
        isRead: false
      });
      await message.save();
      await message.populate('senderId', 'username email');
      Logger.info('[MESSAGE_CONSUMER] Message created successfully', {
        messageId: message._id.toString(),
        conversationId: conversationId.toString(),
        senderId,
        category: 'message-consumer'
      });
      return message;
    } catch (error) {
      Logger.error('[MESSAGE_CONSUMER] Failed to create message', error as Error, {
        conversationId: conversationId.toString(),
        senderId,
        category: 'message-consumer'
      });
      throw error;
    }
  }
  private async updateAutoMessageStatus(autoMessageId: string): Promise<void> {
    try {
      const result = await AutoMessage.markAsSent(new Types.ObjectId(autoMessageId));
      if (!result) {
        Logger.warn('[MESSAGE_CONSUMER] AutoMessage not found for status update', {
          autoMessageId,
          category: 'message-consumer'
        });
        return;
      }
      Logger.debug('[MESSAGE_CONSUMER] AutoMessage status updated to sent', {
        autoMessageId,
        category: 'message-consumer'
      });
    } catch (error) {
      Logger.error('[MESSAGE_CONSUMER] Failed to update AutoMessage status', error as Error, {
        autoMessageId,
        category: 'message-consumer'
      });
    }
  }
  public createNotificationData(message: any): AutoMessageNotification {
    return {
      messageId: message._id.toString(),
      conversationId: message.conversationId.toString(),
      senderId: message.senderId._id.toString(),
      senderInfo: {
        _id: message.senderId._id.toString(),
        username: message.senderId.username,
        email: message.senderId.email
      },
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      isAutoMessage: true
    };
  }
}
export const messageConsumerService = MessageConsumerService.getInstance();
