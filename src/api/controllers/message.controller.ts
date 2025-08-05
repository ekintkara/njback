import { Response } from 'express';
import { messageService } from '../../services/message.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import Logger from '../../utils/logger';
export class MessageController {
  public async getMessagesByConversationId(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { conversationId } = req.params;
      const userId = req.user!.userId;
      const { page = 1, limit = 20 } = req.query;
      Logger.info('[MESSAGE] Get messages attempt', {
        conversationId,
        userId,
        page,
        limit,
        category: 'message'
      });
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const result = await messageService.getMessagesByConversationId(
        conversationId,
        userId,
        pageNum,
        limitNum
      );
      Logger.info('[MESSAGE] Get messages successful', {
        conversationId,
        userId,
        page: pageNum,
        limit: limitNum,
        total: result.pagination.total,
        category: 'message'
      });
      res.status(200).json({
        success: true,
        message: 'Messages retrieved successfully',
        data: result
      });
    } catch (error) {
      Logger.error('[MESSAGE] Get messages failed', error as Error, {
        conversationId: req.params?.conversationId || 'unknown',
        userId: req.user?.userId || 'unknown',
        page: req.query?.page || 'unknown',
        limit: req.query?.limit || 'unknown',
        category: 'message'
      });
      throw error;
    }
  }
  public async createMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { conversationId, content } = req.body;
      const senderId = req.user!.userId;
      Logger.info('[MESSAGE] Create message attempt', {
        conversationId,
        senderId,
        contentLength: content?.length || 0,
        category: 'message'
      });
      const message = await messageService.createMessage(
        conversationId,
        senderId,
        content
      );
      Logger.info('[MESSAGE] Create message successful', {
        messageId: message._id,
        conversationId,
        senderId,
        category: 'message'
      });
      res.status(201).json({
        success: true,
        message: 'Message created successfully',
        data: {
          message
        }
      });
    } catch (error) {
      Logger.error('[MESSAGE] Create message failed', error as Error, {
        conversationId: req.body?.conversationId || 'unknown',
        senderId: req.user?.userId || 'unknown',
        contentLength: req.body?.content?.length || 0,
        category: 'message'
      });
      throw error;
    }
  }
}
export const messageController = new MessageController();
