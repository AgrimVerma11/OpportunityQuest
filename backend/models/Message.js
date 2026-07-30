import mongoose from "mongoose";

// A single message within a conversation. Immutable once sent — there is no
// edit or delete path.
const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// A thread's messages in chronological order.
messageSchema.index({ conversationId: 1, createdAt: 1 });

export default mongoose.model("Message", messageSchema);
