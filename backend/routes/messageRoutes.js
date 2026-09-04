const express = require("express");
const {
  sendMessage,
  getMessages,
  markMessagesAsRead,
  editMessage,
  deleteMessage,
  reactToMessage,
  getUnreadCounts,
} = require("../controllers/messageController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

// Must come before /:conversationId or Express matches "unread-counts" as an ID
router.get("/unread-counts", getUnreadCounts);

router.post("/", sendMessage);
router.get("/:conversationId", getMessages);
router.put("/read", markMessagesAsRead);
router.put("/:messageId", editMessage);
router.delete("/:messageId", deleteMessage);
router.post("/:messageId/react", reactToMessage);

module.exports = router;