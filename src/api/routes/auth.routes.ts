import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validationMiddleware } from '../middlewares/validation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';
import { RegisterDto, LoginDto, RefreshTokenDto, UpdateProfileDto, LogoutDto } from '../dto/auth.dto';

const router = Router();
const authController = new AuthController();

router.post(
  '/register',
  validationMiddleware(RegisterDto),
  authController.register
);

router.post(
  '/login',
  validationMiddleware(LoginDto),
  authController.login
);

router.post(
  '/refresh',
  validationMiddleware(RefreshTokenDto),
  authController.refreshTokens
);

router.get(
  '/me',
  authMiddleware,
  authController.me
);

router.patch(
  '/me',
  authMiddleware,
  validationMiddleware(UpdateProfileDto),
  authController.updateProfile
);

router.post(
  '/logout',
  authMiddleware,
  validationMiddleware(LogoutDto),
  authController.logout
);

export default router;
