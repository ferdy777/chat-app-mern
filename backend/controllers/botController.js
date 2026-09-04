const { getBotReply } = require("../utils/seedBot");

const guestChatWithBot = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "text is required" });
    }

    setTimeout(() => {
      res.status(200).json({
        sender: "ChatApp Bot",
        text: getBotReply(text),
        createdAt: new Date(),
      });
    }, 800);
  } catch (error) {
    console.error("guestChatWithBot error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { guestChatWithBot };