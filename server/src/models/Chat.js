import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    chatName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    isGroup: {
      type: Boolean,
      default: false,
      index: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true, 
      },
    ],
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
  },
  { timestamps: true }
);

// Fast inbox lookup for a user's chats sorted by most recent activity
chatSchema.index({ participants: 1, updatedAt: -1 });

export default mongoose.model('Chat', chatSchema);