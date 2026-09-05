const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
      trim: true,
    },
    groupAvatar: {
      type: String,
      default: "",
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    // 1:1 conversations start as "pending" message requests until the
    // receiver accepts them. Groups are always "accepted".
    status: {
      type: String,
      enum: ["pending", "accepted"],
      default: "accepted",
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Users who deleted this chat from their own list (1:1 only). Hidden
    // from their conversation list until new activity clears this list.
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Per-user "high water mark" for deletes. When a user removes a 1:1
    // chat, we record the timestamp here instead of touching any messages.
    // Anything at/after that timestamp is hidden from THAT user only if the
    // chat gets revived (they message again / accept a new request) — the
    // other participant's view is completely unaffected.
    clearedAt: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date },
      },
    ],
  },
  { timestamps: true }
);

// Speed up "find conversation between these users" lookups
conversationSchema.index({ participants: 1 });

module.exports = mongoose.model("Conversation", conversationSchema);