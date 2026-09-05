const express = require("express");
const {
  accessConversation,
  getConversations,
  getMessageRequests,
  acceptRequest,
  declineRequest,
  createGroupConversation,
  deleteGroup,
  leaveGroup,
} = require("../controllers/conversationController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post("/", accessConversation);
router.get("/", getConversations);
router.get("/requests", getMessageRequests);
router.post("/group", createGroupConversation);

router.put("/:conversationId/accept", acceptRequest);
router.delete("/:conversationId/decline", declineRequest);
router.post("/:conversationId/leave", leaveGroup);
router.delete("/:conversationId", deleteGroup);

module.exports = router;