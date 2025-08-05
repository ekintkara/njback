import { Request, Response, NextFunction } from 'express';
import { UserService } from '../../services/user.service';
import { UserListQueryDto } from '../dto/user.dto';
export class UserController {
  private userService: UserService;
  constructor() {
    this.userService = new UserService();
  }
  getUserList = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query: UserListQueryDto = req.query as any;
      const result = await this.userService.getUserList(query);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };
}
