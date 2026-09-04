const Conversation = require("../models/Conversation");

// @route POST /api/conversations
// body: { receiverId }  -> finds or creates a 1-on-1 conversation
const accessConversation = async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (!receiverId) return res.status(400).json({ message: "receiverId is required" });

    let conversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [req.user._id, receiverId], $size: 2 },
    })
      .populate("participants", "-password")
      .populate("lastMessage");

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, receiverId],
      });
      conversation = await conversation.populate("participants", "-password");
    }

    res.status(200).json(conversation);
  } catch (error) {
    console.error("accessConversation error:", error.message);
    res.status(500).json({ message: "Server error accessing conversation" });
  }
};

// @route GET /api/conversations
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: { $in: [req.user._id] },
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

// @route POST /api/conversations/group
// body: { groupName, participantIds: [...] }
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

module.exports = { accessConversation, getConversations, createGroupConversation };
