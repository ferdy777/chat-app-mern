const express = require("express");
const {
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
} = require("../controllers/userController");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/", getAllUsers);
router.get("/search", searchUsers);
router.put("/profile", updateProfile);

router.put("/privacy", updatePrivacy);
router.put("/status", updateStatus);

router.get("/blocked", getBlockedUsers);
router.post("/block/:userId", blockUser);
router.delete("/block/:userId", unblockUser);

router.put("/change-password", changePassword);
router.put("/change-email", updateEmail);
router.delete("/account", deleteAccount);

router.post("/push/subscribe", subscribePush);
router.post("/push/unsubscribe", unsubscribePush);

module.exports = router;