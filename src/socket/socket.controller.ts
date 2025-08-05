import { Server as SocketIOServer } from 'socket.io';
import { Types } from 'mongoose';
import Logger from '../utils/logger';
import { requireAuth, getConversationRoom } from './socket.middleware';
import Conversation from '../models/conversation.model';
import { MessageService } from '../services/message.service';
import {
  AuthenticatedSocket,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  SOCKET_EVENTS,
  JoinConversationData,
  LeaveConversationData,
  SendMessageData,
  TypingStartData,
  TypingStopData
} from '../types/socket.types';
export class SocketController {
  private messageService: MessageService;
  constructor(
    private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
  ) {
    this.messageService = new MessageService();
  }
  public setupSocketHandlers(socket: AuthenticatedSocket): void {
    socket.on(SOCKET_EVENTS.JOIN_CONVERSATION, (data) => this.handleJoinConversation(socket, data));
    socket.on(SOCKET_EVENTS.LEAVE_CONVERSATION, (data) => this.handleLeaveConversation(socket, data));
    socket.on(SOCKET_EVENTS.MESSAGE_SEND, (data) => this.handleSendMessage(socket, data));
    socket.on(SOCKET_EVENTS.TYPING_START, (data) => this.handleTypingStart(socket, data));
    socket.on(SOCKET_EVENTS.TYPING_STOP, (data) => this.handleTypingStop(socket, data));
  }
  private async handleJoinConversation(socket: AuthenticatedSocket, data: JoinConversationData): Promise<void> {
    try {
      if (!requireAuth(socket)) return;
      const { conversationId } = data;
      const userId = socket.userId!;
      Logger.info('[SOCKET] Join conversation attempt', {
        socketId: socket.id,
        userId,
        conversationId,
        category: 'socket'
      });
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND'
        });
        return;
      }
      if (!conversation.isParticipant(new Types.ObjectId(userId))) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: 'Access denied: You are not a participant in this conversation',
          code: 'ACCESS_DENIED'
        });
        return;
      }
      const roomName = getConversationRoom(conversationId);
      await socket.join(roomName);
      socket.to(roomName).emit(SOCKET_EVENTS.CONVERSATION_JOINED, {
        conversationId,
        userId,
        username: socket.user!.username
      });
      Logger.info('[SOCKET] User joined conversation', {
        socketId: socket.id,
        userId,
        username: socket.user!.username,
        conversationId,
        category: 'socket'
      });
    } catch (error) {
      Logger.error('[SOCKET] Error joining conversation', error instanceof Error ? error : new Error('Unknown error'), {
        socketId: socket.id,
        userId: socket.userId || 'unknown',
        conversationId: data.conversationId,
        category: 'socket'
      });
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'Failed to join conversation',
        code: 'JOIN_CONVERSATION_ERROR'
      });
    }
  }
  private async handleLeaveConversation(socket: AuthenticatedSocket, data: LeaveConversationData): Promise<void> {
    try {
      if (!requireAuth(socket)) return;
      const { conversationId } = data;
      const userId = socket.userId!;
      Logger.info('[SOCKET] Leave conversation attempt', {
        socketId: socket.id,
        userId,
        conversationId,
        category: 'socket'
      });
      const roomName = getConversationRoom(conversationId);
      socket.to(roomName).emit(SOCKET_EVENTS.CONVERSATION_LEFT, {
        conversationId,
        userId,
        username: socket.user!.username
      });
      await socket.leave(roomName);
      Logger.info('[SOCKET] User left conversation', {
        socketId: socket.id,
        userId,
        username: socket.user!.username,
        conversationId,
        category: 'socket'
      });
    } catch (error) {
      Logger.error('[SOCKET] Error leaving conversation', error instanceof Error ? error : new Error('Unknown error'), {
        socketId: socket.id,
        userId: socket.userId || 'unknown',
        conversationId: data.conversationId,
        category: 'socket'
      });
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'Failed to leave conversation',
        code: 'LEAVE_CONVERSATION_ERROR'
      });
    }
  }
  private async handleSendMessage(socket: AuthenticatedSocket, data: SendMessageData): Promise<void> {
    try {
      if (!requireAuth(socket)) return;
      const { conversationId, content } = data;
      const userId = socket.userId!;
      Logger.info('[SOCKET] Send message attempt', {
        socketId: socket.id,
        userId,
        conversationId,
        contentLength: content.length,
        category: 'socket'
      });
      const message = await this.messageService.createMessage(conversationId, userId, content);
      const roomName = getConversationRoom(conversationId);
      const populatedSender = message.senderId as any; // senderId is populated with user data
      this.io.to(roomName).emit(SOCKET_EVENTS.MESSAGE_NEW, {
        messageId: message._id.toString(),
        conversationId: message.conversationId.toString(),
        senderId: populatedSender._id.toString(),
        senderInfo: {
          _id: populatedSender._id.toString(),
          username: populatedSender.username,
          email: populatedSender.email
        },
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        isRead: message.isRead
      });
      Logger.info('[SOCKET] Message sent successfully', {
        socketId: socket.id,
        userId,
        messageId: message._id.toString(),
        conversationId,
        category: 'socket'
      });
    } catch (error) {
      Logger.error('[SOCKET] Error sending message', error instanceof Error ? error : new Error('Unknown error'), {
        socketId: socket.id,
        userId: socket.userId || 'unknown',
        conversationId: data.conversationId,
        category: 'socket'
      });
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: 'Failed to send message',
        code: 'SEND_MESSAGE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  private handleTypingStart(socket: AuthenticatedSocket, data: TypingStartData): void {
    try {
      if (!requireAuth(socket)) return;
      const { conversationId } = data;
      const userId = socket.userId!;
      const username = socket.user!.username;
      const roomName = getConversationRoom(conversationId);
      socket.to(roomName).emit(SOCKET_EVENTS.USER_TYPING, {
        conversationId,
        userId,
        username
      });
      Logger.debug('[SOCKET] User started typing', {
        socketId: socket.id,
        userId,
        username,
        conversationId,
        category: 'socket'
      });
    } catch (error) {
      Logger.error('[SOCKET] Error handling typing start', error instanceof Error ? error : new Error('Unknown error'), {
        socketId: socket.id,
        userId: socket.userId || 'unknown',
        category: 'socket'
      });
    }
  }
  private handleTypingStop(socket: AuthenticatedSocket, data: TypingStopData): void {
    try {
      if (!requireAuth(socket)) return;
      const { conversationId } = data;
      const userId = socket.userId!;
      const username = socket.user!.username;
      const roomName = getConversationRoom(conversationId);
      socket.to(roomName).emit(SOCKET_EVENTS.USER_STOP_TYPING, {
        conversationId,
        userId,
        username
      });
      Logger.debug('[SOCKET] User stopped typing', {
        socketId: socket.id,
        userId,
        username,
        conversationId,
        category: 'socket'
      });
    } catch (error) {
      Logger.error('[SOCKET] Error handling typing stop', error instanceof Error ? error : new Error('Unknown error'), {
        socketId: socket.id,
        userId: socket.userId || 'unknown',
        category: 'socket'
      });
    }
  }
}
