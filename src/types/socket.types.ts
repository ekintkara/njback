import { Socket } from 'socket.io';
export interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    _id: string;
    username: string;
    email: string;
  };
}
export interface ServerToClientEvents {
  'message:new': (data: NewMessageData) => void;
  'message:delivered': (data: MessageDeliveredData) => void;
  'message:read': (data: MessageReadData) => void;
  'user:online': (data: UserStatusData) => void;
  'user:offline': (data: UserStatusData) => void;
  'user:typing': (data: TypingData) => void;
  'user:stop-typing': (data: TypingData) => void;
  'conversation:joined': (data: ConversationJoinedData) => void;
  'conversation:left': (data: ConversationLeftData) => void;
  'error': (data: SocketErrorData) => void;
}
export interface ClientToServerEvents {
  'join:conversation': (data: JoinConversationData) => void;
  'leave:conversation': (data: LeaveConversationData) => void;
  'message:send': (data: SendMessageData) => void;
  'message:mark-delivered': (data: MarkDeliveredData) => void;
  'message:mark-read': (data: MarkReadData) => void;
  'typing:start': (data: TypingStartData) => void;
  'typing:stop': (data: TypingStopData) => void;
  'status:update': (data: StatusUpdateData) => void;
}
export interface InterServerEvents {
  ping: () => void;
}
export interface SocketData {
  userId: string;
  username: string;
  email: string;
}
export interface NewMessageData {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderInfo: {
    _id: string;
    username: string;
    email: string;
  };
  content: string;
  createdAt: string;
  isRead: boolean;
}
export interface MessageDeliveredData {
  messageId: string;
  conversationId: string;
  deliveredTo: string;
  deliveredAt: string;
}
export interface MessageReadData {
  messageId: string;
  conversationId: string;
  readBy: string;
  readAt: string;
}
export interface UserStatusData {
  userId: string;
  username: string;
  status: 'online' | 'offline';
  lastSeen?: string;
}
export interface TypingData {
  conversationId: string;
  userId: string;
  username: string;
}
export interface ConversationJoinedData {
  conversationId: string;
  userId: string;
  username: string;
}
export interface ConversationLeftData {
  conversationId: string;
  userId: string;
  username: string;
}
export interface SocketErrorData {
  message: string;
  code?: string;
  details?: any;
}
export interface JoinConversationData {
  conversationId: string;
}
export interface LeaveConversationData {
  conversationId: string;
}
export interface SendMessageData {
  conversationId: string;
  content: string;
}
export interface MarkDeliveredData {
  messageId: string;
  conversationId: string;
}
export interface MarkReadData {
  messageId: string;
  conversationId: string;
}
export interface TypingStartData {
  conversationId: string;
}
export interface TypingStopData {
  conversationId: string;
}
export interface StatusUpdateData {
  status: 'online' | 'offline';
}
export type ConversationRoom = `conversation:${string}`;
export type UserRoom = `user:${string}`;
export const SOCKET_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  JOIN_CONVERSATION: 'join:conversation',
  LEAVE_CONVERSATION: 'leave:conversation',
  CONVERSATION_JOINED: 'conversation:joined',
  CONVERSATION_LEFT: 'conversation:left',
  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',
  MESSAGE_DELIVERED: 'message:delivered',
  MESSAGE_READ: 'message:read',
  MESSAGE_MARK_DELIVERED: 'message:mark-delivered',
  MESSAGE_MARK_READ: 'message:mark-read',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  USER_TYPING: 'user:typing',
  USER_STOP_TYPING: 'user:stop-typing',
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  STATUS_UPDATE: 'status:update',
  ERROR: 'error'
} as const;
export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
