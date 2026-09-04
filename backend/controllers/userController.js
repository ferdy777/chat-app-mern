const User = require("../models/User");
const Message = require("../models/Message");
const cloudinary = require("../config/cloudinary");
const { getIO } = require("../socket/socket");

// @route GET /api/users
// Returns all users except the logged-in one, minus anyone blocked in either direction
const getAllUsers = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("blockedUsers");
    const blockedByMe = me.blockedUsers.map((id) => id.toString());
    const blockedMeDocs = await User.find({ blockedUsers: req.user._id }).select("_id");
    const blockedMe = blockedMeDocs.map((u) => u._id.toString());
    const excludeIds = [...new Set([...blockedByMe, ...blockedMe])];

    const users = await User.find({ _id: { $ne: req.user._id, $nin: excludeIds } })
      .select("-password")
      .sort({ fullName: 1 });
    res.status(200).json(users);
  } catch (error) {
    console.error("getAllUsers error:", error.message);
    res.status(500).json({ message: "Server error fetching users" });
  }
};

// @route GET /api/users/search?query=
const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(200).json([]);

    const me = await User.findById(req.user._id).select("blockedUsers");
    const blockedByMe = me.blockedUsers.map((id) => id.toString());
    const blockedMeDocs = await User.find({ blockedUsers: req.user._id }).select("_id");
    const blockedMe = blockedMeDocs.map((u) => u._id.toString());
    const excludeIds = [...new Set([...blockedByMe, ...blockedMe])];

    const users = await User.find({
      _id: { $ne: req.user._id, $nin: excludeIds },
      $or: [
        { username: { $regex: query, $options: "i" } },
        { fullName: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    }).select("-password");

    res.status(200).json(users);
  } catch (error) {
    console.error("searchUsers error:", error.message);
    res.status(500).json({ message: "Server error searching users" });
  }
};

// @route PUT /api/users/profile
const updateProfile = async (req, res) => {
  try {
    const { fullName, bio, avatarBase64 } = req.body;
    const updates = {};

    if (fullName) updates.fullName = fullName;
    if (bio) updates.bio = bio;

    if (avatarBase64) {
      const uploadRes = await cloudinary.uploader.upload(avatarBase64, {
        folder: "chat_app/avatars",
      });
      updates.avatar = uploadRes.secure_url;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
    }).select("-password");

    res.status(200).json(user);
  } catch (error) {
    console.error("updateProfile error:", error.message);
    res.status(500).json({ message: "Server error updating profile" });
  }
};

// @route PUT /api/users/privacy
const updatePrivacy = async (req, res) => {
  try {
    const { lastSeenVisible, readReceiptsEnabled } = req.body;
    const updates = {};
    if (lastSeenVisible !== undefined) updates["privacy.lastSeenVisible"] = lastSeenVisible;
    if (readReceiptsEnabled !== undefined) updates["privacy.readReceiptsEnabled"] = readReceiptsEnabled;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select(
      "-password"
    );
    res.status(200).json(user);
  } catch (error) {
    console.error("updatePrivacy error:", error.message);
    res.status(500).json({ message: "Server error updating privacy settings" });
  }
};

// @route PUT /api/users/status  body: { status: "online" | "away" | "busy" }
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["online", "away", "busy"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const user = await User.findByIdAndUpdate(req.user._id, { status }, { new: true }).select(
      "-password"
    );

    const io = getIO();
    if (io) io.emit("userStatusChanged", { userId: req.user._id.toString(), status });

    res.status(200).json(user);
  } catch (error) {
    console.error("updateStatus error:", error.message);
    res.status(500).json({ message: "Server error updating status" });
  }
};

// @route POST /api/users/block/:userId
const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: "You can't block yourself" });
    }
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { blockedUsers: userId } });
    res.status(200).json({ message: "User blocked" });
  } catch (error) {
    console.error("blockUser error:", error.message);
    res.status(500).json({ message: "Server error blocking user" });
  }
};

// @route DELETE /api/users/block/:userId
const unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    await User.findByIdAndUpdate(req.user._id, { $pull: { blockedUsers: userId } });
    res.status(200).json({ message: "User unblocked" });
  } catch (error) {
    console.error("unblockUser error:", error.message);
    res.status(500).json({ message: "Server error unblocking user" });
  }
};

// @route GET /api/users/blocked
const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("blockedUsers", "-password");
    res.status(200).json(user.blockedUsers);
  } catch (error) {
    console.error("getBlockedUsers error:", error.message);
    res.status(500).json({ message: "Server error fetching blocked users" });
  }
};

// @route PUT /api/users/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(401).json({ message: "Current password is incorrect" });

    user.password = newPassword; // pre("save") hook hashes it
    await user.save();

    res.status(200).json({ message: "Password updated" });
  } catch (error) {
    console.error("changePassword error:", error.message);
    res.status(500).json({ message: "Server error changing password" });
  }
};

// @route PUT /api/users/change-email
const updateEmail = async (req, res) => {
  try {
    const { newEmail, password } = req.body;
    if (!newEmail || !password) {
      return res.status(400).json({ message: "New email and password are required" });
    }

    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "Password is incorrect" });

    const existing = await User.findOne({ email: newEmail.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: "Email already in use" });

    user.email = newEmail.toLowerCase().trim();
    await user.save();

    res.status(200).json(user);
  } catch (error) {
    console.error("updateEmail error:", error.message);
    res.status(500).json({ message: "Server error updating email" });
  }
};

// @route DELETE /api/users/account  body: { password }
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id);
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "Password is incorrect" });

    // Anonymize messages instead of cascading delete, so other users' conversation
    // history doesn't break or show broken sender refs.
    await Message.updateMany(
      { sender: user._id },
      { $set: { text: "[deleted account]", isDeleted: true } }
    );
    await User.findByIdAndDelete(user._id);

    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Account deleted" });
  } catch (error) {
    console.error("deleteAccount error:", error.message);
    res.status(500).json({ message: "Server error deleting account" });
  }
};

// @route POST /api/users/push/subscribe  body: PushSubscription object
const subscribePush = async (req, res) => {
  try {
    const subscription = req.body;
    if (!subscription?.endpoint) {
      return res.status(400).json({ message: "Invalid subscription" });
    }
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { pushSubscriptions: subscription },
    });
    res.status(201).json({ message: "Subscribed" });
  } catch (error) {
    console.error("subscribePush error:", error.message);
    res.status(500).json({ message: "Server error saving push subscription" });
  }
};

// @route POST /api/users/push/unsubscribe  body: { endpoint }
const unsubscribePush = async (req, res) => {
  try {
    const { endpoint } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { pushSubscriptions: { endpoint } },
    });
    res.status(200).json({ message: "Unsubscribed" });
  } catch (error) {
    console.error("unsubscribePush error:", error.message);
    res.status(500).json({ message: "Server error removing push subscription" });
  }
};

module.exports = {
  getAllUsers,
  searchUsers,
  updateProfile,
  updatePrivacy,
  updateStatus,
  blockUser,
  unblockUser,
  getBlockedUsers,
  changePassword,
  updateEmail,
  deleteAccount,
  subscribePush,
  unsubscribePush,
};