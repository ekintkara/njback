import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import SocketService from './socket.service';

jest.mock('../config/socket');
jest.mock('../utils/logger');

describe('SocketService', () => {
  let httpServer: HTTPServer;
  let socketService: SocketService;
  let mockIO: Partial<SocketIOServer>;

  beforeEach(() => {
    httpServer = {} as HTTPServer;

    mockIO = {
      use: jest.fn(),
      on: jest.fn().mockReturnThis()
    };

    // Mock createSocketServer
    const { createSocketServer } = require('../config/socket');
    createSocketServer.mockReturnValue(mockIO);

    socketService = new SocketService(httpServer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize Socket.IO server with middleware', () => {
    expect(mockIO.use).toHaveBeenCalled();
    expect(mockIO.on).toHaveBeenCalled();
  });

  it('should provide connection tracking methods', () => {
    expect(typeof socketService.getConnectedUserCount).toBe('function');
    expect(typeof socketService.isUserConnected).toBe('function');
    expect(typeof socketService.getSocketByUserId).toBe('function');
    expect(typeof socketService.getConnectedUsers).toBe('function');
    expect(typeof socketService.getIO).toBe('function');
  });

  it('should return Socket.IO server instance', () => {
    const io = socketService.getIO();
    expect(io).toBe(mockIO);
  });
});
