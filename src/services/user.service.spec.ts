import { UserService } from './user.service';
import User from '../models/user.model';
import { AuthService } from './auth.service';

describe('UserService', () => {
  let userService: UserService;
  let authService: AuthService;

  beforeEach(() => {
    userService = new UserService();
    authService = new AuthService();
  });

  afterEach(async () => {
    await User.deleteMany({});
  });

  describe('getUserList', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 15; i++) {
        await authService.register({
          username: `user${i}`,
          email: `user${i}@example.com`,
          password: 'Password123'
        });
      }
    });

    it('should return user list with default pagination', async () => {
      const result = await userService.getUserList({});

      expect(result.users).toHaveLength(10);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.totalUsers).toBe(15);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPrevPage).toBe(false);
    });

    it('should return user list with custom pagination', async () => {
      const result = await userService.getUserList({ page: 2, limit: 5 });

      expect(result.users).toHaveLength(5);
      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.totalUsers).toBe(15);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPrevPage).toBe(true);
    });

    it('should return last page correctly', async () => {
      const result = await userService.getUserList({ page: 2, limit: 10 });

      expect(result.users).toHaveLength(5);
      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.totalUsers).toBe(15);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPrevPage).toBe(true);
    });

    it('should not include password in user data', async () => {
      const result = await userService.getUserList({});

      result.users.forEach(user => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('createdAt');
        expect(user).toHaveProperty('updatedAt');
        expect(user).not.toHaveProperty('password');
      });
    });

    it('should return empty list when no users exist', async () => {
      await User.deleteMany({});

      const result = await userService.getUserList({});

      expect(result.users).toHaveLength(0);
      expect(result.pagination.totalUsers).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPrevPage).toBe(false);
    });

    it('should handle large page numbers gracefully', async () => {
      const result = await userService.getUserList({ page: 100, limit: 10 });

      expect(result.users).toHaveLength(0);
      expect(result.pagination.currentPage).toBe(100);
      expect(result.pagination.totalUsers).toBe(15);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPrevPage).toBe(true);
    });

    it('should sort users by creation date (newest first)', async () => {
      const result = await userService.getUserList({ limit: 15 });

      for (let i = 0; i < result.users.length - 1; i++) {
        const currentUser = new Date(result.users[i].createdAt);
        const nextUser = new Date(result.users[i + 1].createdAt);
        expect(currentUser.getTime()).toBeGreaterThanOrEqual(nextUser.getTime());
      }
    });
  });
});
