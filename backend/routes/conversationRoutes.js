const express = require("express");
const {
  accessConversation,
  getConversations,
  createGroupConversation,
} = require("../controllers/conversationController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post("/", accessConversation);
router.get("/", getConversations);
router.post("/group", createGroupConversation);

module.exports = router;
