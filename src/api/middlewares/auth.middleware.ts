import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../services/auth.service';
import { AppError } from '../../utils/app-error';

export const authMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError('Authorization header is required', 401, 'UNAUTHORIZED');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('Authorization header must start with Bearer', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      throw new AppError('Access token is required', 401, 'UNAUTHORIZED');
    }

    const authService = new AuthService();
    const decoded = await authService.verifyAccessToken(token);

    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));
    }
  }
};
