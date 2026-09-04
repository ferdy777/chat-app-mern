const express = require("express");
const { guestChatWithBot } = require("../controllers/botController");

const router = express.Router();

router.post("/chat", guestChatWithBot);

module.exports = router;