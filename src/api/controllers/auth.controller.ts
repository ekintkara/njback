import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../services/auth.service';
import { RegisterDto, LoginDto } from '../dto/auth.dto';

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
}
