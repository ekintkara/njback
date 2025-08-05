import { Router } from 'express';
import { messageController } from '../controllers/message.controller';
import { messageValidator } from '../validators/message.validator';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';

const router = Router();

// Apply authentication middleware to all message routes
router.use(authMiddleware);

/**
 * @route   GET /api/messages/:conversationId
 * @desc    Get messages by conversation ID with pagination
 * @access  Private (authenticated users who are participants in the conversation)
 * @param   {string} conversationId - The ID of the conversation
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Number of messages per page (default: 20, max: 100)
 */
router.get(
  '/:conversationId',
  messageValidator.getMessagesByConversationId(),
  validateRequest,
  messageController.getMessagesByConversationId.bind(messageController)
);

/**
 * @route   POST /api/messages
 * @desc    Create a new message in a conversation
 * @access  Private (authenticated users who are participants in the conversation)
 * @body    {string} conversationId - The ID of the conversation
 * @body    {string} content - The message content (1-1000 characters)
 */
router.post(
  '/',
  messageValidator.createMessage(),
  validateRequest,
  messageController.createMessage.bind(messageController)
);

export default router;
