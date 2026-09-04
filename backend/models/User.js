const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    avatar: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "Hey there! I am using ChatApp.",
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    // Manual presence override (away/busy). "offline" is set automatically on disconnect.
    status: {
      type: String,
      enum: ["online", "away", "busy", "offline"],
      default: "online",
    },
    privacy: {
      lastSeenVisible: { type: Boolean, default: true },
      readReceiptsEnabled: { type: Boolean, default: true },
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    pushSubscriptions: [
      {
        endpoint: String,
        keys: {
          p256dh: String,
          auth: String,
        },
      },
    ],
    unreadCounts: [
      {
        conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
        count: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Never send password hash or push subscription keys to client
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.pushSubscriptions;
  return obj;
};

module.exports = mongoose.model("User", userSchema);