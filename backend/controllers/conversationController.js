const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { getIO, getReceiverSocketIds } = require("../socket/socket");

// Hides a conversation's lastMessage in the response (not in the DB) if it
// falls before this user's own "cleared" point — otherwise a deleted-then-
// revived chat would show stale last-message text in the sidebar even
// though the message list itself is correctly empty for that user.
function maskClearedLastMessage(conversation, userId) {
  const clearedEntry = conversation.clearedAt?.find(
    (c) => c.user.toString() === userId.toString()
  );
  if (
    clearedEntry &&
    conversation.lastMessage &&
    new Date(conversation.lastMessage.createdAt) <= new Date(clearedEntry.at)
  ) {
    conversation.lastMessage = null;
  }
  return conversation;
}

// @route POST /api/conversations
// body: { receiverId } -> finds or creates a 1-on-1 conversation.
// A brand-new conversation starts as a pending "message request" so a
// receiver's inbox isn't open to just anyone.
const accessConversation = async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (!receiverId) return res.status(400).json({ message: "receiverId is required" });
    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({ message: "You can't message yourself" });
    }

    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, receiverId], $size: 2 },
    })
      .populate("participants", "-password")
      .populate("lastMessage");

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, receiverId],
        status: "pending",
        requestedBy: req.user._id,
      });
      conversation = await conversation.populate("participants", "-password");

      const io = getIO();
      if (io) {
        getReceiverSocketIds(receiverId).forEach((socketId) => {
          io.to(socketId).emit("newMessageRequest", conversation);
        });
      }
    } else if (conversation.deletedFor?.some((id) => id.toString() === req.user._id.toString())) {
      // Re-starting a chat you'd deleted un-hides it for you again. It does
      // NOT restore old messages — clearedAt (set on delete) keeps those
      // hidden for you specifically; see getMessages.
      await Conversation.updateOne(
        { _id: conversation._id },
        { $pull: { deletedFor: req.user._id } }
      );
      conversation.deletedFor = conversation.deletedFor.filter(
        (id) => id.toString() !== req.user._id.toString()
      );
    }

    conversation = maskClearedLastMessage(conversation, req.user._id);

    res.status(200).json(conversation);
  } catch (error) {
    console.error("accessConversation error:", error.message);
    res.status(500).json({ message: "Server error accessing conversation" });
  }
};

// @route GET /api/conversations
// Regular chat list: groups, accepted 1:1s, and pending 1:1s *you* started
// (so you can see "request sent, waiting for reply") — minus anything you
// deleted from your own list.
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: { $in: [req.user._id] },
      deletedFor: { $ne: req.user._id },
      $or: [
        { isGroup: true },
        { status: "accepted" },
        // Conversations created before the message-request feature existed
        // have no `status` field at all in the DB. Mongo won't match those
        // against `status: "accepted"`, so without this they silently drop
        // out of the list until you re-open them via New Chat.
        { status: { $exists: false } },
        { status: "pending", requestedBy: req.user._id },
      ],
    })
      .populate("participants", "-password")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    const masked = conversations.map((c) => maskClearedLastMessage(c, req.user._id));

    res.status(200).json(masked);
  } catch (error) {
    console.error("getConversations error:", error.message);
    res.status(500).json({ message: "Server error fetching conversations" });
  }
};

// @route GET /api/conversations/requests
// Incoming message requests: pending 1:1s someone else started with you.
const getMessageRequests = async (req, res) => {
  try {
    const requests = await Conversation.find({
      isGroup: false,
      status: "pending",
      participants: { $in: [req.user._id] },
      requestedBy: { $ne: req.user._id },
    })
      .populate("participants", "-password")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error("getMessageRequests error:", error.message);
    res.status(500).json({ message: "Server error fetching message requests" });
  }
};

// @route PUT /api/conversations/:conversationId/accept
const acceptRequest = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId).populate(
      "participants",
      "-password"
    );
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.participants.some((p) => p._id.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: "Not a participant of this conversation" });
    }
    if (conversation.requestedBy?.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "You can't accept your own request" });
    }

    conversation.status = "accepted";
    await conversation.save();

    const io = getIO();
    if (io) {
      conversation.participants.forEach((p) => {
        getReceiverSocketIds(p._id.toString()).forEach((socketId) => {
          io.to(socketId).emit("conversationRequestAccepted", conversation);
        });
      });
    }

    res.status(200).json(conversation);
  } catch (error) {
    console.error("acceptRequest error:", error.message);
    res.status(500).json({ message: "Server error accepting request" });
  }
};

// @route DELETE /api/conversations/:conversationId/decline
// Declining wipes the pending conversation and its messages entirely —
// nothing was ever "accepted" into either inbox.
const declineRequest = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.participants.some((p) => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: "Not a participant of this conversation" });
    }
    if (conversation.status !== "pending") {
      return res.status(400).json({ message: "This conversation isn't a pending request" });
    }

    const participantIds = conversation.participants.map((p) => p.toString());
    await Message.deleteMany({ conversation: conversationId });
    await conversation.deleteOne();

    const io = getIO();
    if (io) {
      participantIds.forEach((pId) => {
        getReceiverSocketIds(pId).forEach((socketId) => {
          io.to(socketId).emit("conversationDeleted", { conversationId });
        });
      });
    }

    res.status(200).json({ message: "Request declined" });
  } catch (error) {
    console.error("declineRequest error:", error.message);
    res.status(500).json({ message: "Server error declining request" });
  }
};

// @route POST /api/conversations/group
const createGroupConversation = async (req, res) => {
  try {
    const { groupName, participantIds } = req.body;
    if (!groupName || !participantIds || participantIds.length < 2) {
      return res
        .status(400)
        .json({ message: "Group name and at least 2 participants are required" });
    }

    const conversation = await Conversation.create({
      isGroup: true,
      groupName,
      participants: [...participantIds, req.user._id],
      admins: [req.user._id],
    });

    const fullConversation = await Conversation.findById(conversation._id).populate(
      "participants",
      "-password"
    );

    res.status(201).json(fullConversation);
  } catch (error) {
    console.error("createGroupConversation error:", error.message);
    res.status(500).json({ message: "Server error creating group" });
  }
};

// @route POST /api/conversations/:conversationId/remove
// Unified "remove this chat" action, used both from the chat list
// (long-press / right-click / multi-select) and from inside an open chat:
//  - 1:1 conversation -> hidden from MY list only, and any messages up to
//    now get "cleared" for me (clearedAt). The other participant keeps
//    everything, and the chat un-hides for me automatically if either of
//    us messages again — but old messages stay hidden for me specifically.
//  - group, and I'm an admin -> deletes the group for everyone.
//  - group, and I'm just a member -> leaves the group (promoting a new
//    admin if I was the last one).
const removeChat = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    const userId = req.user._id.toString();
    if (!conversation.participants.some((p) => p.toString() === userId)) {
      return res.status(403).json({ message: "Not a participant of this conversation" });
    }

    if (!conversation.isGroup) {
      conversation.deletedFor = Array.from(
        new Set([...(conversation.deletedFor || []).map((id) => id.toString()), userId])
      );
      conversation.clearedAt = (conversation.clearedAt || []).filter(
        (c) => c.user.toString() !== userId
      );
      conversation.clearedAt.push({ user: req.user._id, at: new Date() });
      await conversation.save();
      return res.status(200).json({ message: "Chat removed", mode: "hidden" });
    }

    const isAdmin = conversation.admins.some((a) => a.toString() === userId);
    const participantIds = conversation.participants.map((p) => p.toString());

    if (isAdmin) {
      await Message.deleteMany({ conversation: conversationId });
      await conversation.deleteOne();

      const io = getIO();
      if (io) {
        participantIds.forEach((pId) => {
          getReceiverSocketIds(pId).forEach((socketId) => {
            io.to(socketId).emit("groupDeleted", { conversationId });
          });
        });
      }
      return res.status(200).json({ message: "Group deleted", mode: "deleted" });
    }

    conversation.participants = conversation.participants.filter((p) => p.toString() !== userId);
    conversation.admins = conversation.admins.filter((a) => a.toString() !== userId);
    if (conversation.admins.length === 0 && conversation.participants.length > 0) {
      conversation.admins.push(conversation.participants[0]);
    }

    if (conversation.participants.length === 0) {
      await Message.deleteMany({ conversation: conversationId });
      await conversation.deleteOne();
    } else {
      await conversation.save();
    }

    const io = getIO();
    if (io) io.to(conversationId).emit("memberLeftGroup", { conversationId, userId });

    res.status(200).json({ message: "Left group", mode: "left" });
  } catch (error) {
    console.error("removeChat error:", error.message);
    res.status(500).json({ message: "Server error removing chat" });
  }
};

module.exports = {
  accessConversation,
  getConversations,
  getMessageRequests,
  acceptRequest,
  declineRequest,
  createGroupConversation,
  removeChat,
};