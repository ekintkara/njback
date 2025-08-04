import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user.model';
import { AppError } from '../utils/app-error';

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RefreshTokenData {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
}

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly JWT_REFRESH_EXPIRES_IN: string;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
    this.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  }

  async register(registerData: RegisterData): Promise<AuthTokens> {
    const { username, email, password } = registerData;

    try {
      const existingUserByEmail = await User.findOne({ email });
      if (existingUserByEmail) {
        throw new AppError('User with this email already exists', 400);
      }

      const existingUserByUsername = await User.findOne({ username });
      if (existingUserByUsername) {
        throw new AppError('User with this username already exists', 400);
      }

      const newUser = new User({
        username,
        email,
        password
      });

      const savedUser = await newUser.save();

      const tokens = this.generateTokens(savedUser);

      return tokens;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error && 'code' in error && error.code === 11000) {
        const field = Object.keys((error as any).keyPattern)[0];
        throw new AppError(`User with this ${field} already exists`, 400);
      }

      console.error('Registration error:', error);
      throw new AppError('Registration failed', 500);
    }
  }

  private generateTokens(user: IUser): AuthTokens {
    const payload: JWTPayload = {
      userId: user._id.toString(),
      email: user.email,
      username: user.username
    };

    const accessToken = jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(payload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.JWT_REFRESH_EXPIRES_IN
    } as jwt.SignOptions);

    return {
      accessToken,
      refreshToken
    };
  }

  async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      throw new AppError('Invalid or expired token', 401);
    }
  }

  async verifyRefreshToken(token: string): Promise<JWTPayload> {
    try {
      const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  async login(loginData: LoginData): Promise<AuthTokens> {
    const { email, password } = loginData;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        throw new AppError('Invalid email or password', 401);
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401);
      }

      const tokens = this.generateTokens(user);
      return tokens;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error('Login error:', error);
      throw new AppError('Login failed', 500);
    }
  }

  async refreshTokens(refreshTokenData: RefreshTokenData): Promise<AuthTokens> {
    const { refreshToken } = refreshTokenData;

    try {
      const decoded = await this.verifyRefreshToken(refreshToken);

      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new AppError('User not found', 401);
      }

      const tokens = this.generateTokens(user);
      return tokens;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      console.error('Token refresh error:', error);
      throw new AppError('Token refresh failed', 401);
    }
  }
}
