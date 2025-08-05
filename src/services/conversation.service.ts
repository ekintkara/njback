import { Types } from 'mongoose';
import Conversation, { IConversation } from '../models/conversation.model';
import User from '../models/user.model';
import { AppError } from '../utils/app-error';
import Logger from '../utils/logger';

export interface CreateConversationData {
  currentUserId: string;
  participantId: string;
}

export interface ConversationListItem {
  id: string;
  participants: Array<{
    id: string;
    username: string;
    email: string;
  }>;
  lastMessage?: {
    content: string;
    sender: {
      id: string;
      username: string;
    };
    timestamp: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class ConversationService {
  public async createOrFindConversation(data: CreateConversationData): Promise<IConversation> {
    try {
      const { currentUserId, participantId } = data;

      // Validate input
      if (!Types.ObjectId.isValid(currentUserId) || !Types.ObjectId.isValid(participantId)) {
        throw new AppError('Invalid user ID format', 400);
      }

      if (currentUserId === participantId) {
        throw new AppError('Cannot create conversation with yourself', 400);
      }

      const currentUserObjectId = new Types.ObjectId(currentUserId);
      const participantObjectId = new Types.ObjectId(participantId);

      // Check if participant user exists
      const participantUser = await User.findById(participantObjectId);
      if (!participantUser) {
        throw new AppError('Participant user not found', 404);
      }

      // Check if conversation already exists
      const existingConversation = await Conversation.findBetweenUsers(
        currentUserObjectId,
        participantObjectId
      );

      if (existingConversation) {
        Logger.info('Existing conversation found', {
          conversationId: existingConversation._id,
          participants: [currentUserId, participantId],
          category: 'conversation'
        });
        return existingConversation;
      }

      // Create new conversation
      const newConversation = new Conversation({
        participants: [currentUserObjectId, participantObjectId]
      });

      const savedConversation = await newConversation.save();
      
      // Populate participants for response
      await savedConversation.populate('participants', 'username email');

      Logger.info('New conversation created', {
        conversationId: savedConversation._id,
        participants: [currentUserId, participantId],
        category: 'conversation'
      });

      return savedConversation;

    } catch (error) {
      Logger.error('Failed to create or find conversation', error as Error, {
        currentUserId: data.currentUserId,
        participantId: data.participantId
      });
      throw error;
    }
  }

  public async getUserConversations(userId: string): Promise<ConversationListItem[]> {
    try {
      // Validate input
      if (!Types.ObjectId.isValid(userId)) {
        throw new AppError('Invalid user ID format', 400);
      }

      const userObjectId = new Types.ObjectId(userId);

      // Get user conversations
      const conversations = await Conversation.findUserConversations(userObjectId);

      // Transform conversations for response
      const conversationList: ConversationListItem[] = conversations.map(conversation => {
        const participants = conversation.participants
          .filter((participant: any) => participant._id.toString() !== userId)
          .map((participant: any) => ({
            id: participant._id.toString(),
            username: participant.username,
            email: participant.email
          }));

        const result: ConversationListItem = {
          id: conversation._id.toString(),
          participants,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt
        };

        // Add last message if exists
        if (conversation.lastMessage) {
          result.lastMessage = {
            content: conversation.lastMessage.content,
            sender: {
              id: conversation.lastMessage.sender._id?.toString() || conversation.lastMessage.sender.toString(),
              username: (conversation.lastMessage.sender as any).username || 'Unknown'
            },
            timestamp: conversation.lastMessage.timestamp
          };
        }

        return result;
      });

      Logger.info('User conversations retrieved', {
        userId,
        conversationCount: conversationList.length,
        category: 'conversation'
      });

      return conversationList;

    } catch (error) {
      Logger.error('Failed to get user conversations', error as Error, { userId });
      throw error;
    }
  }

  public async getConversationById(conversationId: string, userId: string): Promise<IConversation> {
    try {
      // Validate input
      if (!Types.ObjectId.isValid(conversationId) || !Types.ObjectId.isValid(userId)) {
        throw new AppError('Invalid ID format', 400);
      }

      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        throw new AppError('Conversation not found', 404);
      }

      // Check if user is participant
      const userObjectId = new Types.ObjectId(userId);
      if (!conversation.isParticipant(userObjectId)) {
        throw new AppError('Access denied: You are not a participant in this conversation', 403);
      }

      // Populate participants for response
      await conversation.populate('participants', 'username email');

      return conversation;

    } catch (error) {
      Logger.error('Failed to get conversation by ID', error as Error, {
        conversationId,
        userId
      });
      throw error;
    }
  }

  public async updateLastMessage(
    conversationId: string,
    content: string,
    senderId: string
  ): Promise<IConversation> {
    try {
      // Validate input
      if (!Types.ObjectId.isValid(conversationId) || !Types.ObjectId.isValid(senderId)) {
        throw new AppError('Invalid ID format', 400);
      }

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new AppError('Conversation not found', 404);
      }

      // Check if sender is participant
      const senderObjectId = new Types.ObjectId(senderId);
      if (!conversation.isParticipant(senderObjectId)) {
        throw new AppError('Access denied: You are not a participant in this conversation', 403);
      }

      // Update last message
      await conversation.updateLastMessage(content, senderObjectId);

      Logger.info('Conversation last message updated', {
        conversationId,
        senderId,
        category: 'conversation'
      });

      return conversation;

    } catch (error) {
      Logger.error('Failed to update last message', error as Error, {
        conversationId,
        senderId
      });
      throw error;
    }
  }

  public async deleteConversation(conversationId: string, userId: string): Promise<void> {
    try {
      // Validate input
      if (!Types.ObjectId.isValid(conversationId) || !Types.ObjectId.isValid(userId)) {
        throw new AppError('Invalid ID format', 400);
      }

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new AppError('Conversation not found', 404);
      }

      // Check if user is participant
      const userObjectId = new Types.ObjectId(userId);
      if (!conversation.isParticipant(userObjectId)) {
        throw new AppError('Access denied: You are not a participant in this conversation', 403);
      }

      await Conversation.findByIdAndDelete(conversationId);

      Logger.info('Conversation deleted', {
        conversationId,
        userId,
        category: 'conversation'
      });

    } catch (error) {
      Logger.error('Failed to delete conversation', error as Error, {
        conversationId,
        userId
      });
      throw error;
    }
  }
}

export const conversationService = new ConversationService();
export default conversationService;
