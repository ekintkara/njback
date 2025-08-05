import { Response } from 'express';
import { conversationService } from '../../services/conversation.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import Logger from '../../utils/logger';

export class ConversationController {
  public async createConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { participantId } = req.body;
      const currentUserId = req.user!.userId;

      Logger.info('[CONVERSATION] Create conversation attempt', {
        currentUserId,
        participantId,
        category: 'conversation'
      });

      const conversation = await conversationService.createOrFindConversation({
        currentUserId,
        participantId
      });

      const isNewConversation = conversation.createdAt.getTime() === conversation.updatedAt.getTime();
      const message = isNewConversation ? 'Conversation created successfully' : 'Existing conversation found';

      Logger.info('[CONVERSATION] Create conversation successful', {
        conversationId: conversation._id,
        currentUserId,
        participantId,
        isNew: isNewConversation,
        category: 'conversation'
      });

      res.status(isNewConversation ? 201 : 200).json({
        success: true,
        message,
        data: {
          conversation
        }
      });

    } catch (error) {
      Logger.error('[CONVERSATION] Create conversation failed', error as Error, {
        currentUserId: req.user?.userId,
        participantId: req.body?.participantId,
        category: 'conversation'
      });
      throw error;
    }
  }

  public async getConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { page = 1, limit = 20, search } = req.query;

      Logger.info('[CONVERSATION] Get conversations attempt', {
        userId,
        page,
        limit,
        search,
        category: 'conversation'
      });

      const conversations = await conversationService.getUserConversations(userId);

      // Apply search filter if provided
      let filteredConversations = conversations;
      if (search && typeof search === 'string') {
        const searchLower = search.toLowerCase();
        filteredConversations = conversations.filter(conversation =>
          conversation.participants.some(participant =>
            participant.username.toLowerCase().includes(searchLower) ||
            participant.email.toLowerCase().includes(searchLower)
          )
        );
      }

      // Apply pagination
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;
      const paginatedConversations = filteredConversations.slice(startIndex, endIndex);

      Logger.info('[CONVERSATION] Get conversations successful', {
        userId,
        totalConversations: conversations.length,
        filteredCount: filteredConversations.length,
        returnedCount: paginatedConversations.length,
        page: pageNum,
        limit: limitNum,
        category: 'conversation'
      });

      res.status(200).json({
        success: true,
        message: 'Conversations retrieved successfully',
        data: {
          conversations: paginatedConversations,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: filteredConversations.length,
            totalPages: Math.ceil(filteredConversations.length / limitNum),
            hasNext: endIndex < filteredConversations.length,
            hasPrev: pageNum > 1
          }
        }
      });

    } catch (error) {
      Logger.error('[CONVERSATION] Get conversations failed', error as Error, {
        userId: req.user?.userId || 'unknown',
        category: 'conversation'
      });
      throw error;
    }
  }

  public async getConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const userId = req.user!.userId;

      Logger.info('[CONVERSATION] Get conversation attempt', {
        conversationId,
        userId,
        category: 'conversation'
      });

      const conversation = await conversationService.getConversationById(conversationId, userId);

      Logger.info('[CONVERSATION] Get conversation successful', {
        conversationId,
        userId,
        category: 'conversation'
      });

      res.status(200).json({
        success: true,
        message: 'Conversation retrieved successfully',
        data: {
          conversation
        }
      });

    } catch (error) {
      Logger.error('[CONVERSATION] Get conversation failed', error as Error, {
        conversationId: req.params?.conversationId || 'unknown',
        userId: req.user?.userId || 'unknown',
        category: 'conversation'
      });
      throw error;
    }
  }

  public async deleteConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const userId = req.user!.userId;

      Logger.info('[CONVERSATION] Delete conversation attempt', {
        conversationId,
        userId,
        category: 'conversation'
      });

      await conversationService.deleteConversation(conversationId, userId);

      Logger.info('[CONVERSATION] Delete conversation successful', {
        conversationId,
        userId,
        category: 'conversation'
      });

      res.status(200).json({
        success: true,
        message: 'Conversation deleted successfully'
      });

    } catch (error) {
      Logger.error('[CONVERSATION] Delete conversation failed', error as Error, {
        conversationId: req.params?.conversationId || 'unknown',
        userId: req.user?.userId || 'unknown',
        category: 'conversation'
      });
      throw error;
    }
  }
}

export const conversationController = new ConversationController();
export default conversationController;
