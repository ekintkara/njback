import { Types } from 'mongoose';
import Message, { IMessage } from '../models/message.model';
import Conversation from '../models/conversation.model';
import { AppError } from '../utils/app-error';
import Logger from '../utils/logger';
export interface MessageListItem {
  id: string;
  conversationId: string;
  senderId: {
    id: string;
    username: string;
    email: string;
  };
  content: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface PaginatedMessagesResponse {
  messages: MessageListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
export class MessageService {
  public async getMessagesByConversationId(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedMessagesResponse> {
    try {
      if (!Types.ObjectId.isValid(conversationId) || !Types.ObjectId.isValid(userId)) {
        throw new AppError('Invalid ID format', 400);
      }
      if (page < 1) {
        throw new AppError('Page must be greater than 0', 400);
      }
      if (limit < 1 || limit > 100) {
        throw new AppError('Limit must be between 1 and 100', 400);
      }
      const conversationObjectId = new Types.ObjectId(conversationId);
      const userObjectId = new Types.ObjectId(userId);
      const conversation = await Conversation.findById(conversationObjectId);
      if (!conversation) {
        throw new AppError('Conversation not found', 404);
      }
      if (!conversation.isParticipant(userObjectId)) {
        throw new AppError('Access denied: You are not a participant in this conversation', 403);
      }
      const result = await Message.findByConversationId(conversationObjectId, page, limit);
      const messages: MessageListItem[] = result.messages.map((message: any) => ({
        id: message._id.toString(),
        conversationId: message.conversationId.toString(),
        senderId: {
          id: message.senderId._id.toString(),
          username: message.senderId.username,
          email: message.senderId.email
        },
        content: message.content,
        isRead: message.isRead,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt
      }));
      const totalPages = Math.ceil(result.total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      const response: PaginatedMessagesResponse = {
        messages,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages,
          hasNext,
          hasPrev
        }
      };
      Logger.info('Messages retrieved successfully', {
        conversationId,
        userId,
        page,
        limit,
        total: result.total,
        category: 'message'
      });
      return response;
    } catch (error) {
      Logger.error('Failed to get messages by conversation ID', error as Error, {
        conversationId,
        userId,
        page,
        limit
      });
      throw error;
    }
  }
  public async createMessage(
    conversationId: string,
    senderId: string,
    content: string
  ): Promise<IMessage> {
    try {
      if (!Types.ObjectId.isValid(conversationId) || !Types.ObjectId.isValid(senderId)) {
        throw new AppError('Invalid ID format', 400);
      }
      if (!content || content.trim().length === 0) {
        throw new AppError('Message content is required', 400);
      }
      if (content.length > 1000) {
        throw new AppError('Message content cannot exceed 1000 characters', 400);
      }
      const conversationObjectId = new Types.ObjectId(conversationId);
      const senderObjectId = new Types.ObjectId(senderId);
      const conversation = await Conversation.findById(conversationObjectId);
      if (!conversation) {
        throw new AppError('Conversation not found', 404);
      }
      if (!conversation.isParticipant(senderObjectId)) {
        throw new AppError('Access denied: You are not a participant in this conversation', 403);
      }
      const message = new Message({
        conversationId: conversationObjectId,
        senderId: senderObjectId,
        content: content.trim()
      });
      const savedMessage = await message.save();
      await conversation.updateLastMessage(content.trim(), senderObjectId);
      await savedMessage.populate('senderId', 'username email');
      Logger.info('Message created successfully', {
        messageId: savedMessage._id,
        conversationId,
        senderId,
        category: 'message'
      });
      return savedMessage;
    } catch (error) {
      Logger.error('Failed to create message', error as Error, {
        conversationId,
        senderId,
        contentLength: content?.length || 0
      });
      throw error;
    }
  }
}
export const messageService = new MessageService();
