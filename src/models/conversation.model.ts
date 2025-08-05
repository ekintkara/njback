import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILastMessage {
  content: string;
  sender: Types.ObjectId;
  timestamp: Date;
}

export interface IConversation extends Document {
  _id: Types.ObjectId;
  participants: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: ILastMessage;
  isParticipant(userId: Types.ObjectId): boolean;
  getOtherParticipant(userId: Types.ObjectId): Types.ObjectId | null;
  updateLastMessage(content: string, senderId: Types.ObjectId): Promise<IConversation>;
}

const LastMessageSchema = new Schema<ILastMessage>({
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  }
}, { _id: false });

const ConversationSchema = new Schema<IConversation>({
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: LastMessageSchema,
    required: false
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

// Indexes for efficient queries
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ updatedAt: -1 });
ConversationSchema.index({ participants: 1, updatedAt: -1 });

// Validation: Ensure exactly 2 participants
ConversationSchema.pre('validate', function(next) {
  if (this.participants.length !== 2) {
    next(new Error('Conversation must have exactly 2 participants'));
  } else {
    next();
  }
});

// Validation: Ensure participants are different
ConversationSchema.pre('validate', function(next) {
  const [participant1, participant2] = this.participants;
  if (participant1.toString() === participant2.toString()) {
    next(new Error('Participants must be different users'));
  } else {
    next();
  }
});

// Static method to find conversation between two users
ConversationSchema.statics.findBetweenUsers = function(userId1: Types.ObjectId, userId2: Types.ObjectId) {
  return this.findOne({
    participants: {
      $all: [userId1, userId2],
      $size: 2
    }
  }).populate('participants', 'username email');
};

// Static method to find user conversations
ConversationSchema.statics.findUserConversations = function(userId: Types.ObjectId) {
  return this.find({
    participants: userId
  })
  .populate('participants', 'username email')
  .populate('lastMessage.sender', 'username')
  .sort({ updatedAt: -1 });
};

// Instance method to check if user is participant
ConversationSchema.methods.isParticipant = function(userId: Types.ObjectId): boolean {
  return this.participants.some((participant: Types.ObjectId) => 
    participant.toString() === userId.toString()
  );
};

// Instance method to get other participant
ConversationSchema.methods.getOtherParticipant = function(userId: Types.ObjectId): Types.ObjectId | null {
  const otherParticipant = this.participants.find((participant: Types.ObjectId) => 
    participant.toString() !== userId.toString()
  );
  return otherParticipant || null;
};

// Instance method to update last message
ConversationSchema.methods.updateLastMessage = function(content: string, senderId: Types.ObjectId) {
  this.lastMessage = {
    content,
    sender: senderId,
    timestamp: new Date()
  };
  this.updatedAt = new Date();
  return this.save();
};

export interface IConversationModel extends mongoose.Model<IConversation> {
  findBetweenUsers(userId1: Types.ObjectId, userId2: Types.ObjectId): Promise<IConversation | null>;
  findUserConversations(userId: Types.ObjectId): Promise<IConversation[]>;
}

const Conversation = mongoose.model<IConversation, IConversationModel>('Conversation', ConversationSchema);

export default Conversation;
