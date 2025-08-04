import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from './auth.middleware';
import { AuthService } from '../../services/auth.service';
import { AppError } from '../../utils/app-error';

jest.mock('../../services/auth.service');

describe('authMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    mockResponse = {};
    mockNext = jest.fn();
    
    mockAuthService = {
      verifyAccessToken: jest.fn()
    } as any;
    
    (AuthService as jest.MockedClass<typeof AuthService>).mockImplementation(() => mockAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call next() with valid token', async () => {
    const mockUser = {
      userId: 'user123',
      email: 'test@example.com',
      username: 'testuser'
    };

    mockRequest.headers = {
      authorization: 'Bearer valid-token'
    };

    mockAuthService.verifyAccessToken.mockResolvedValue(mockUser);

    await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockAuthService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect(mockRequest.user).toEqual(mockUser);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should call next() with AppError when no authorization header', async () => {
    mockRequest.headers = {};

    await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Authorization header is required',
        statusCode: 401,
        errorCode: 'UNAUTHORIZED'
      })
    );
  });

  it('should call next() with AppError when authorization header does not start with Bearer', async () => {
    mockRequest.headers = {
      authorization: 'Basic invalid-format'
    };

    await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Authorization header must start with Bearer',
        statusCode: 401,
        errorCode: 'UNAUTHORIZED'
      })
    );
  });

  it('should call next() with AppError when token is empty', async () => {
    mockRequest.headers = {
      authorization: 'Bearer '
    };

    await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Access token is required',
        statusCode: 401,
        errorCode: 'UNAUTHORIZED'
      })
    );
  });

  it('should call next() with AppError when token verification fails', async () => {
    mockRequest.headers = {
      authorization: 'Bearer invalid-token'
    };

    mockAuthService.verifyAccessToken.mockRejectedValue(new AppError('Invalid token', 401));

    await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid token',
        statusCode: 401
      })
    );
  });

  it('should call next() with generic error when unexpected error occurs', async () => {
    mockRequest.headers = {
      authorization: 'Bearer valid-token'
    };

    mockAuthService.verifyAccessToken.mockRejectedValue(new Error('Unexpected error'));

    await authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Unauthorized',
        statusCode: 401,
        errorCode: 'UNAUTHORIZED'
      })
    );
  });
});
