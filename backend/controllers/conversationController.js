const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const { getIO, getReceiverSocketId } = require("../socket/socket");

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
      const receiverSocketId = getReceiverSocketId(receiverId);
      if (io && receiverSocketId) {
        io.to(receiverSocketId).emit("newMessageRequest", conversation);
      }
    }

    res.status(200).json(conversation);
  } catch (error) {
    console.error("accessConversation error:", error.message);
    res.status(500).json({ message: "Server error accessing conversation" });
  }
};

// @route GET /api/conversations
// Regular chat list: groups, accepted 1:1s, and pending 1:1s *you* started
// (so you can see "request sent, waiting for reply").
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: { $in: [req.user._id] },
      $or: [
        { isGroup: true },
        { status: "accepted" },
        { status: "pending", requestedBy: req.user._id },
      ],
    })
      .populate("participants", "-password")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    res.status(200).json(conversations);
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
        const socketId = getReceiverSocketId(p._id.toString());
        if (socketId) io.to(socketId).emit("conversationRequestAccepted", conversation);
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
        const socketId = getReceiverSocketId(pId);
        if (socketId) io.to(socketId).emit("conversationDeleted", { conversationId });
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

// @route DELETE /api/conversations/:conversationId
// Group only, admin-only. Deletes the group and all its messages for everyone.
const deleteGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.isGroup) {
      return res.status(400).json({ message: "Not a group conversation" });
    }
    if (!conversation.admins.some((a) => a.toString() === req.user._id.toString())) {
      return res.status(403).json({ message: "Only group admins can delete the group" });
    }

    const participantIds = conversation.participants.map((p) => p.toString());
    await Message.deleteMany({ conversation: conversationId });
    await conversation.deleteOne();

    const io = getIO();
    if (io) {
      participantIds.forEach((pId) => {
        const socketId = getReceiverSocketId(pId);
        if (socketId) io.to(socketId).emit("groupDeleted", { conversationId });
      });
    }

    res.status(200).json({ message: "Group deleted" });
  } catch (error) {
    console.error("deleteGroup error:", error.message);
    res.status(500).json({ message: "Server error deleting group" });
  }
};

// @route POST /api/conversations/:conversationId/leave
// Group only. Any member can leave. If the last admin leaves and others
// remain, the next member is promoted to admin so the group isn't orphaned.
const leaveGroup = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });
    if (!conversation.isGroup) {
      return res.status(400).json({ message: "Not a group conversation" });
    }

    const userId = req.user._id.toString();
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

    res.status(200).json({ message: "Left group" });
  } catch (error) {
    console.error("leaveGroup error:", error.message);
    res.status(500).json({ message: "Server error leaving group" });
  }
};

module.exports = {
  accessConversation,
  getConversations,
  getMessageRequests,
  acceptRequest,
  declineRequest,
  createGroupConversation,
  deleteGroup,
  leaveGroup,
};