import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { validationMiddleware } from '../middlewares/validation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { UserListQueryDto } from '../dto/user.dto';
const router = Router();
const userController = new UserController();
router.get(
  '/list',
  authMiddleware,
  validationMiddleware(UserListQueryDto, 'query'),
  userController.getUserList
);
export default router;
