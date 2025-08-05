import { Router } from 'express';
import { messageController } from '../controllers/message.controller';
import { messageValidator } from '../validators/message.validator';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateRequest } from '../middlewares/validation.middleware';
const router = Router();
router.use(authMiddleware);
router.get(
  '/:conversationId',
  messageValidator.getMessagesByConversationId(),
  validateRequest,
  messageController.getMessagesByConversationId.bind(messageController)
);
router.post(
  '/',
  messageValidator.createMessage(),
  validateRequest,
  messageController.createMessage.bind(messageController)
);
export default router;
