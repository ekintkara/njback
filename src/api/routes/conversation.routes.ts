import { Router } from 'express';
import { conversationController } from '../controllers/conversation.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
import {
  createConversationValidator,
  getConversationValidator,
  getConversationsValidator,
  deleteConversationValidator
} from '../validators/conversation.validator';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route   POST /api/conversations
 * @desc    Create a new conversation or get existing one
 * @access  Private
 * @body    { participantId: string }
 */
router.post(
  '/',
  createConversationValidator,
  validateRequest,
  conversationController.createConversation
);

/**
 * @route   GET /api/conversations
 * @desc    Get all conversations for the authenticated user
 * @access  Private
 * @query   { page?: number, limit?: number, search?: string }
 */
router.get(
  '/',
  getConversationsValidator,
  validateRequest,
  conversationController.getConversations
);

/**
 * @route   GET /api/conversations/:conversationId
 * @desc    Get a specific conversation by ID
 * @access  Private
 * @param   conversationId - The conversation ID
 */
router.get(
  '/:conversationId',
  getConversationValidator,
  validateRequest,
  conversationController.getConversation
);

/**
 * @route   DELETE /api/conversations/:conversationId
 * @desc    Delete a conversation
 * @access  Private
 * @param   conversationId - The conversation ID
 */
router.delete(
  '/:conversationId',
  deleteConversationValidator,
  validateRequest,
  conversationController.deleteConversation
);

export default router;
