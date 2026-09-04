const User = require("../models/User");

const BOT_EMAIL = "bot@chatapp.local";
const BOT_USERNAME = "chatapp_bot";

const KEYWORD_REPLIES = [
  { keywords: ["hi", "hello", "hey", "yo", "sup"], replies: ["Hey there! 👋 How's it going?", "Hello! Good to see you here.", "Hey! What's up?"] },
  { keywords: ["how are you", "how're you", "hows it going"], replies: ["I'm just a bot so I don't have feelings, but I'm running smoothly! You?", "All good on my end — just here to test the chat with you."] },
  { keywords: ["thanks", "thank you", "thx", "appreciate"], replies: ["You're welcome! 🙌", "Anytime!", "No problem at all."] },
  { keywords: ["bye", "goodbye", "see you", "later"], replies: ["See you later! 👋", "Bye for now!"] },
  { keywords: ["name", "who are you", "what are you"], replies: ["I'm ChatApp Bot — a scripted assistant built into this app so you always have someone to test messages with."] },
  { keywords: ["real", "human", "person"], replies: ["Nope, just a bot! But real people can join too — anyone who signs up shows up in your contacts."] },
  { keywords: ["cool", "nice", "awesome", "great", "good job"], replies: ["Glad you like it! 😄", "Thanks, appreciate that!"] },
  { keywords: ["?"], replies: ["Good question! I'm a simple scripted bot so I can't answer everything, but the real-time chat behind this message is fully working.", "I can't answer deep questions, but I can confirm: your message just round-tripped through the server successfully!"] },
  { keywords: ["profile", "picture", "avatar", "upload"], replies: ["Profile picture uploads work once Cloudinary keys are set in the backend .env."] },
];

const FALLBACK_REPLIES = [
  "Got it — thanks for the message!",
  "Message received loud and clear ✅",
  "Nice, real-time messaging is working correctly.",
  "That came through instantly via Socket.io.",
  "Noted! Try asking me something like 'hi' or 'who are you'.",
];

async function seedBotUser() {
  let bot = await User.findOne({ email: BOT_EMAIL });

  if (!bot) {
    bot = await User.create({
      fullName: "ChatApp Bot",
      username: BOT_USERNAME,
      email: BOT_EMAIL,
      password: require("crypto").randomBytes(20).toString("hex"),
      bio: "I'm an automated bot — message me to test real-time chat!",
      isOnline: true,
    });
    console.log("Seeded ChatApp Bot user");
  } else if (!bot.isOnline) {
    bot.isOnline = true;
    await bot.save();
  }

  return bot;
}

function getBotReply(incomingText = "") {
  const text = incomingText.toLowerCase();

  for (const rule of KEYWORD_REPLIES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      return rule.replies[Math.floor(Math.random() * rule.replies.length)];
    }
  }

  return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)];
}

module.exports = { seedBotUser, getBotReply, BOT_EMAIL };