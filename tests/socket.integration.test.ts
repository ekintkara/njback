import { createServer } from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app';
import SocketService from '../src/services/socket.service';
import User from '../src/models/user.model';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/env';

describe.skip('Socket.IO Integration Tests', () => {
  let httpServer: any;
  let socketService: SocketService;
  let clientSocket: ClientSocket;
  let serverAddress: string;

  beforeAll(async () => {
    const app = createApp();
    httpServer = createServer(app);
    socketService = new SocketService(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        const port = httpServer.address()?.port;
        serverAddress = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  afterEach(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    await User.deleteMany({});
  });

  describe('Socket Authentication', () => {
    it('should connect successfully with valid JWT token', async () => {
      // Create a test user
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      });
      await user.save();

      // Generate valid token
      const token = jwt.sign(
        { userId: user._id.toString(), email: user.email, username: user.username },
        config.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Connect with token
      clientSocket = Client(serverAddress, {
        auth: {
          token
        }
      });

      await new Promise<void>((resolve, reject) => {
        clientSocket.on('connect', () => {
          expect(clientSocket.connected).toBe(true);
          resolve();
        });

        clientSocket.on('connect_error', (error) => {
          reject(error);
        });

        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      // Should receive connected event
      await new Promise<void>((resolve) => {
        clientSocket.on('connected', (data) => {
          expect(data.message).toBe('Successfully connected to real-time messaging');
          expect(data.userId).toBe(user._id.toString());
          expect(data.username).toBe(user.username);
          resolve();
        });
      });
    });

    it('should reject connection with invalid token', async () => {
      clientSocket = Client(serverAddress, {
        auth: {
          token: 'invalid-token'
        }
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect_error', (error) => {
          expect(error.message).toContain('Invalid token');
          resolve();
        });

        clientSocket.on('connect', () => {
          throw new Error('Should not connect with invalid token');
        });

        setTimeout(() => resolve(), 2000);
      });
    });

    it('should reject connection without token', async () => {
      clientSocket = Client(serverAddress);

      await new Promise<void>((resolve) => {
        clientSocket.on('connect_error', (error) => {
          expect(error.message).toContain('Authentication token required');
          resolve();
        });

        clientSocket.on('connect', () => {
          throw new Error('Should not connect without token');
        });

        setTimeout(() => resolve(), 2000);
      });
    });

    it('should reject connection with expired token', async () => {
      // Create a test user
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      });
      await user.save();

      // Generate expired token
      const expiredToken = jwt.sign(
        { userId: user._id.toString(), email: user.email, username: user.username },
        config.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      clientSocket = Client(serverAddress, {
        auth: {
          token: expiredToken
        }
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect_error', (error) => {
          expect(error.message).toContain('Token expired');
          resolve();
        });

        clientSocket.on('connect', () => {
          throw new Error('Should not connect with expired token');
        });

        setTimeout(() => resolve(), 2000);
      });
    });

    it('should track user connection and disconnection', async () => {
      // Create a test user
      const user = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashedpassword'
      });
      await user.save();

      // Generate valid token
      const token = jwt.sign(
        { userId: user._id.toString(), email: user.email, username: user.username },
        config.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Connect
      clientSocket = Client(serverAddress, {
        auth: {
          token
        }
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', () => {
          expect(socketService.isUserConnected(user._id.toString())).toBe(true);
          expect(socketService.getConnectedUserCount()).toBe(1);
          resolve();
        });
      });

      // Disconnect
      clientSocket.disconnect();

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(socketService.isUserConnected(user._id.toString())).toBe(false);
          expect(socketService.getConnectedUserCount()).toBe(0);
          resolve();
        }, 100);
      });
    });
  });
});
