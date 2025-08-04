import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../services/auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from '../dto/auth.dto';
import User from '../../models/user.model';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const registerData: RegisterDto = req.body;

      const tokens = await this.authService.register(registerData);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loginData: LoginDto = req.body;

      const tokens = await this.authService.login(loginData);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  };

  refreshTokens = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshTokenData: RefreshTokenDto = req.body;

      const tokens = await this.authService.refreshTokens(refreshTokenData);

      res.status(200).json({
        success: true,
        message: 'Tokens refreshed successfully',
        data: tokens
      });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new Error('User not found in request');
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        throw new Error('User not found in database');
      }

      res.status(200).json({
        success: true,
        data: {
          id: user._id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
