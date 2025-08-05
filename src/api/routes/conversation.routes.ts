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
router.use(authMiddleware);
router.post(
  '/',
  createConversationValidator,
  validateRequest,
  conversationController.createConversation
);
router.get(
  '/',
  getConversationsValidator,
  validateRequest,
  conversationController.getConversations
);
router.get(
  '/:conversationId',
  getConversationValidator,
  validateRequest,
  conversationController.getConversation
);
router.delete(
  '/:conversationId',
  deleteConversationValidator,
  validateRequest,
  conversationController.deleteConversation
);
export default router;
