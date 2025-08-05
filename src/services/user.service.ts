import User from '../models/user.model';
import { AppError } from '../utils/app-error';
export interface UserListQuery {
  page?: number;
  limit?: number;
}
export interface UserListResponse {
  users: Array<{
    id: string;
    username: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
export class UserService {
  async getUserList(query: UserListQuery): Promise<UserListResponse> {
    try {
      const page = query.page || 1;
      const limit = query.limit || 10;
      const skip = (page - 1) * limit;
      const totalUsers = await User.countDocuments();
      const totalPages = Math.ceil(totalUsers / limit);
      const users = await User.find()
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      const userList = users.map(user => ({
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }));
      return {
        users: userList,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      console.error('Get user list error:', error);
      throw new AppError('Failed to retrieve user list', 500);
    }
  }
}
