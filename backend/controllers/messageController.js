const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const cloudinary = require("../config/cloudinary");
const User = require("../models/User");
const { getBotReply, BOT_EMAIL } = require("../utils/seedBot");
const { getIO, getReceiverSocketIds } = require("../socket/socket");
const { sendPushToUser } = require("../utils/pushService");

// Shared populate shape for a message's quoted reply — kept minimal so we're
// not dragging a full nested user doc along on every single message.
const REPLY_POPULATE = {
  path: "replyTo",
  select: "text image isDeleted sender",
  populate: { path: "sender", select: "fullName" },
};

const sendMessage = async (req, res) => {
  try {
    const { conversationId, text, imageBase64, replyTo } = req.body;

    if (!conversationId || (!text && !imageBase64)) {
      return res.status(400).json({ message: "conversationId and text or image are required" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    if (!conversation.participants.some((p) => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: "Not a participant of this conversation" });
    }

    // Block check — 1:1 chats only, groups are unaffected
    if (!conversation.isGroup) {
      const otherId = conversation.participants.find(
        (p) => p.toString() !== req.user._id.toString()
      );
      if (otherId) {
        const [me, other] = await Promise.all([
          User.findById(req.user._id).select("blockedUsers"),
          User.findById(otherId).select("blockedUsers"),
        ]);
        const iBlockedThem = me.blockedUsers.some((id) => id.toString() === otherId.toString());
        const theyBlockedMe = other?.blockedUsers.some(
          (id) => id.toString() === req.user._id.toString()
        );
        if (iBlockedThem || theyBlockedMe) {
          return res.status(403).json({ message: "You can't message this user" });
        }
      }
    }

    // Message-request gate: the receiver of a still-pending 1:1 conversation
    // can't send until they explicitly accept it. The requester can keep
    // sending while it's pending.
    if (
      !conversation.isGroup &&
      conversation.status === "pending" &&
      conversation.requestedBy?.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "Accept this message request before replying",
        code: "REQUEST_PENDING",
      });
    }

    // Only accept a replyTo that's actually a message in THIS conversation —
    // otherwise someone could quote a message from a chat they're not in.
    let validReplyTo;
    if (replyTo) {
      const original = await Message.findOne({ _id: replyTo, conversation: conversationId });
      if (original) validReplyTo = original._id;
    }

    let imageUrl;
    if (imageBase64) {
      const uploadRes = await cloudinary.uploader.upload(imageBase64, {
        folder: "chat_app/messages",
      });
      imageUrl = uploadRes.secure_url;
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: req.user._id,
      text,
      image: imageUrl,
      replyTo: validReplyTo,
    });

    conversation.lastMessage = message._id;
    // New activity un-hides the chat for anyone who'd deleted it from their list.
    conversation.deletedFor = [];
    await conversation.save();

    const populatedMessage = await message.populate([
      { path: "sender", select: "-password" },
      REPLY_POPULATE,
    ]);

    res.status(201).json(populatedMessage);

    // Persisted unread counts + push for every other participant
    const otherParticipants = conversation.participants.filter(
      (p) => p.toString() !== req.user._id.toString()
    );

    Promise.all(
      otherParticipants.map(async (participantId) => {
        await User.updateOne(
          { _id: participantId, "unreadCounts.conversation": conversationId },
          { $inc: { "unreadCounts.$.count": 1 } }
        );
        await User.updateOne(
          { _id: participantId, "unreadCounts.conversation": { $ne: conversationId } },
          { $push: { unreadCounts: { conversation: conversationId, count: 1 } } }
        );

        const isOnlineAnywhere = getReceiverSocketIds(participantId.toString()).length > 0;
        if (!isOnlineAnywhere) {
          sendPushToUser(participantId, {
            title: req.user.fullName || "New message",
            body: text ? text.slice(0, 120) : "Sent an image",
            icon: req.user.avatar || "/icon-192.png",
            data: { conversationId: conversationId.toString() },
          });
        }
      })
    ).catch((err) => console.error("post-send processing error:", err.message));

    maybeSendBotReply(conversation, req.user._id, text).catch((err) =>
      console.error("bot reply error:", err.message)
    );
  } catch (error) {
    console.error("sendMessage error:", error.message);
    res.status(500).json({ message: "Server error sending message" });
  }
};

async function maybeSendBotReply(conversation, senderId, incomingText) {
  const otherParticipantId = conversation.participants.find(
    (p) => p.toString() !== senderId.toString()
  );
  if (!otherParticipantId) return;

  const bot = await User.findOne({ email: BOT_EMAIL, _id: otherParticipantId });
  if (!bot) return;

  setTimeout(async () => {
    try {
      const botMessage = await Message.create({
        conversation: conversation._id,
        sender: bot._id,
        text: getBotReply(incomingText),
      });

      conversation.lastMessage = botMessage._id;
      conversation.deletedFor = [];
      await conversation.save();

      const populatedBotMessage = await botMessage.populate("sender", "-password");

      const io = getIO();
      if (io) {
        io.to(conversation._id.toString()).emit("newMessage", populatedBotMessage);
      }

      // Bot replies also bump unread count for the human participant
      await User.updateOne(
        { _id: senderId, "unreadCounts.conversation": conversation._id },
        { $inc: { "unreadCounts.$.count": 1 } }
      );
      await User.updateOne(
        { _id: senderId, "unreadCounts.conversation": { $ne: conversation._id } },
        { $push: { unreadCounts: { conversation: conversation._id, count: 1 } } }
      );
    } catch (err) {
      console.error("Failed to send bot reply:", err.message);
    }
  }, 1200);
}

const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    if (!conversation.participants.some((p) => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: "Not a participant of this conversation" });
    }

    const query = { conversation: conversationId };

    // If this user previously deleted this chat, hide messages from before
    // that point so restarting it doesn't dump all the old history back on
    // them. The other participant's view is untouched.
    const clearedEntry = conversation.clearedAt?.find(
      (c) => c.user.toString() === req.user._id.toString()
    );
    if (clearedEntry) {
      query.createdAt = { $gt: clearedEntry.at };
    }

    const totalCount = await Message.countDocuments(query);

    const messages = await Message.find(query)
      .populate("sender", "-password")
      .populate(REPLY_POPULATE)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Tell the client whether there's anything older left to page in, so it
    // knows when to stop firing "load more" requests on scroll-to-top.
    const hasMore = page * limit < totalCount;

    res.status(200).json({ messages: messages.reverse(), hasMore });
  } catch (error) {
    console.error("getMessages error:", error.message);
    res.status(500).json({ message: "Server error fetching messages" });
  }
};

const markMessagesAsRead = async (req, res) => {
  try {
    const { conversationId, messageIds } = req.body;
    if (!messageIds?.length) return res.status(400).json({ message: "messageIds required" });

    const reader = await User.findById(req.user._id).select("privacy");
    const receiptsAllowed = reader?.privacy?.readReceiptsEnabled !== false;

    if (receiptsAllowed) {
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $addToSet: { readBy: req.user._id }, $set: { status: "read" } }
      );
    }

    if (conversationId) {
      await User.updateOne(
        { _id: req.user._id, "unreadCounts.conversation": conversationId },
        { $set: { "unreadCounts.$.count": 0 } }
      );
    }

    res.status(200).json({ message: "Messages marked as read" });

    if (conversationId && receiptsAllowed) {
      const io = getIO();
      if (io) {
        io.to(conversationId).emit("messagesRead", {
          conversationId,
          messageIds,
          readerId: req.user._id,
        });
      }
    }
  } catch (error) {
    console.error("markMessagesAsRead error:", error.message);
    res.status(500).json({ message: "Server error updating read status" });
  }
};

const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: "text is required" });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only edit your own messages" });
    }
    if (message.isDeleted) return res.status(400).json({ message: "Can't edit a deleted message" });

    message.text = text.trim();
    message.isEdited = true;
    await message.save();

    const populated = await message.populate([
      { path: "sender", select: "-password" },
      REPLY_POPULATE,
    ]);

    const io = getIO();
    if (io) io.to(message.conversation.toString()).emit("messageEdited", populated);

    res.status(200).json(populated);
  } catch (error) {
    console.error("editMessage error:", error.message);
    res.status(500).json({ message: "Server error editing message" });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can only delete your own messages" });
    }

    message.isDeleted = true;
    message.text = "";
    message.image = undefined;
    message.reactions = [];
    await message.save();

    const io = getIO();
    if (io) {
      io.to(message.conversation.toString()).emit("messageDeleted", {
        messageId: message._id,
        conversationId: message.conversation,
      });
    }

    res.status(200).json({ message: "Message deleted" });
  } catch (error) {
    console.error("deleteMessage error:", error.message);
    res.status(500).json({ message: "Server error deleting message" });
  }
};

const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ message: "emoji is required" });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const existingIndex = message.reactions.findIndex(
      (r) => r.user.toString() === req.user._id.toString() && r.emoji === emoji
    );

    if (existingIndex > -1) {
      message.reactions.splice(existingIndex, 1);
    } else {
      message.reactions = message.reactions.filter(
        (r) => r.user.toString() !== req.user._id.toString()
      );
      message.reactions.push({ user: req.user._id, emoji });
    }

    await message.save();
    const populated = await message.populate([
      { path: "sender", select: "-password" },
      REPLY_POPULATE,
    ]);

    const io = getIO();
    if (io) io.to(message.conversation.toString()).emit("messageReacted", populated);

    res.status(200).json(populated);
  } catch (error) {
    console.error("reactToMessage error:", error.message);
    res.status(500).json({ message: "Server error reacting to message" });
  }
};

// @route GET /api/messages/unread-counts
const getUnreadCounts = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("unreadCounts");
    const map = {};
    user.unreadCounts.forEach((u) => {
      map[u.conversation.toString()] = u.count;
    });
    res.status(200).json(map);
  } catch (error) {
    console.error("getUnreadCounts error:", error.message);
    res.status(500).json({ message: "Server error fetching unread counts" });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  markMessagesAsRead,
  editMessage,
  deleteMessage,
  reactToMessage,
  getUnreadCounts,
};