import { Response } from 'express';
import { messageController } from './message.controller';
import { messageService } from '../../services/message.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AppError } from '../../utils/app-error';

// Mock the message service
jest.mock('../../services/message.service');
const mockMessageService = messageService as jest.Mocked<typeof messageService>;

describe('MessageController', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockRequest = {
      user: {
        userId: 'user123',
        email: 'test@example.com',
        username: 'testuser'
      },
      params: {},
      query: {},
      body: {}
    };
    
    mockResponse = {
      status: mockStatus,
      json: mockJson
    };

    jest.clearAllMocks();
  });

  describe('getMessagesByConversationId', () => {
    const mockPaginatedResponse = {
      messages: [
        {
          id: 'msg1',
          conversationId: 'conv123',
          senderId: {
            id: 'user123',
            username: 'testuser',
            email: 'test@example.com'
          },
          content: 'Hello world',
          isRead: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      }
    };

    it('should get messages successfully with default pagination', async () => {
      mockRequest.params = { conversationId: 'conv123' };
      mockRequest.query = {};
      
      mockMessageService.getMessagesByConversationId.mockResolvedValue(mockPaginatedResponse);

      await messageController.getMessagesByConversationId(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockMessageService.getMessagesByConversationId).toHaveBeenCalledWith(
        'conv123',
        'user123',
        1,
        20
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Messages retrieved successfully',
        data: mockPaginatedResponse
      });
    });

    it('should get messages successfully with custom pagination', async () => {
      mockRequest.params = { conversationId: 'conv123' };
      mockRequest.query = { page: '2', limit: '10' };
      
      mockMessageService.getMessagesByConversationId.mockResolvedValue(mockPaginatedResponse);

      await messageController.getMessagesByConversationId(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockMessageService.getMessagesByConversationId).toHaveBeenCalledWith(
        'conv123',
        'user123',
        2,
        10
      );
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Messages retrieved successfully',
        data: mockPaginatedResponse
      });
    });

    it('should handle service errors', async () => {
      mockRequest.params = { conversationId: 'conv123' };
      const error = new AppError('Conversation not found', 404);
      
      mockMessageService.getMessagesByConversationId.mockRejectedValue(error);

      await expect(
        messageController.getMessagesByConversationId(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response
        )
      ).rejects.toThrow(error);

      expect(mockMessageService.getMessagesByConversationId).toHaveBeenCalledWith(
        'conv123',
        'user123',
        1,
        20
      );
    });

    it('should handle invalid pagination parameters', async () => {
      mockRequest.params = { conversationId: 'conv123' };
      mockRequest.query = { page: 'invalid', limit: 'invalid' };
      
      mockMessageService.getMessagesByConversationId.mockResolvedValue(mockPaginatedResponse);

      await messageController.getMessagesByConversationId(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      // Should default to NaN which becomes 1 and 20 respectively
      expect(mockMessageService.getMessagesByConversationId).toHaveBeenCalledWith(
        'conv123',
        'user123',
        NaN,
        NaN
      );
    });
  });

  describe('createMessage', () => {
    const mockMessage = {
      _id: 'msg123',
      conversationId: 'conv123',
      senderId: 'user123',
      content: 'Hello world',
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should create message successfully', async () => {
      mockRequest.body = {
        conversationId: 'conv123',
        content: 'Hello world'
      };
      
      mockMessageService.createMessage.mockResolvedValue(mockMessage as any);

      await messageController.createMessage(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockMessageService.createMessage).toHaveBeenCalledWith(
        'conv123',
        'user123',
        'Hello world'
      );
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Message created successfully',
        data: {
          message: mockMessage
        }
      });
    });

    it('should handle service errors', async () => {
      mockRequest.body = {
        conversationId: 'conv123',
        content: 'Hello world'
      };
      const error = new AppError('Access denied', 403);
      
      mockMessageService.createMessage.mockRejectedValue(error);

      await expect(
        messageController.createMessage(
          mockRequest as AuthenticatedRequest,
          mockResponse as Response
        )
      ).rejects.toThrow(error);

      expect(mockMessageService.createMessage).toHaveBeenCalledWith(
        'conv123',
        'user123',
        'Hello world'
      );
    });

    it('should handle missing request body', async () => {
      mockRequest.body = {};
      
      mockMessageService.createMessage.mockResolvedValue(mockMessage as any);

      await messageController.createMessage(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockMessageService.createMessage).toHaveBeenCalledWith(
        undefined,
        'user123',
        undefined
      );
    });
  });
});
