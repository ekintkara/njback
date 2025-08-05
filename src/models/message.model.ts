import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMessage extends Document {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  conversationId: {
    type: Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(_doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Compound index for efficient pagination queries
MessageSchema.index({ conversationId: 1, createdAt: -1 });

// Index for read status queries
MessageSchema.index({ conversationId: 1, isRead: 1 });

export interface IMessageModel extends mongoose.Model<IMessage> {
  findByConversationId(conversationId: Types.ObjectId, page: number, limit: number): Promise<{
    messages: IMessage[];
    total: number;
  }>;
}

// Static method to find messages by conversation with pagination
MessageSchema.statics.findByConversationId = async function(
  conversationId: Types.ObjectId, 
  page: number = 1, 
  limit: number = 20
) {
  const skip = (page - 1) * limit;
  
  const [messages, total] = await Promise.all([
    this.find({ conversationId })
      .populate('senderId', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments({ conversationId })
  ]);

  return { messages, total };
};

const Message = mongoose.model<IMessage, IMessageModel>('Message', MessageSchema);

export default Message;
