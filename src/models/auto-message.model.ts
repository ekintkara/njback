import mongoose, { Document, Schema, Types } from 'mongoose';
export interface IAutoMessage extends Document {
  _id: Types.ObjectId;
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  content: string;
  sendDate: Date;
  isQueued: boolean;
  isSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface IAutoMessageModel extends mongoose.Model<IAutoMessage> {
  findPendingMessages(currentDate: Date): Promise<IAutoMessage[]>;
  markAsQueued(messageIds: Types.ObjectId[]): Promise<any>;
  markAsSent(messageId: Types.ObjectId): Promise<IAutoMessage | null>;
}
const AutoMessageSchema = new Schema<IAutoMessage>({
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  receiverId: {
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
  sendDate: {
    type: Date,
    required: true,
    index: true
  },
  isQueued: {
    type: Boolean,
    default: false,
    index: true
  },
  isSent: {
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
AutoMessageSchema.index({ sendDate: 1, isQueued: 1 });
AutoMessageSchema.index({ isQueued: 1, isSent: 1 });
AutoMessageSchema.index({ senderId: 1, createdAt: -1 });
AutoMessageSchema.index({ receiverId: 1, createdAt: -1 });
AutoMessageSchema.statics.findPendingMessages = function(currentDate: Date) {
  return this.find({
    sendDate: { $lte: currentDate },
    isQueued: false,
    isSent: false
  }).populate('senderId', 'username email')
    .populate('receiverId', 'username email');
};
AutoMessageSchema.statics.markAsQueued = function(messageIds: Types.ObjectId[]) {
  return this.updateMany(
    { _id: { $in: messageIds } },
    { $set: { isQueued: true } }
  );
};
AutoMessageSchema.statics.markAsSent = function(messageId: Types.ObjectId) {
  return this.findByIdAndUpdate(
    messageId,
    { $set: { isSent: true } },
    { new: true }
  );
};
const AutoMessage = mongoose.model<IAutoMessage, IAutoMessageModel>('AutoMessage', AutoMessageSchema);
export default AutoMessage;
