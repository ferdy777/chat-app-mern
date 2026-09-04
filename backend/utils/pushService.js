const webpush = require("web-push");
const User = require("../models/User");

// Generate once with: npx web-push generate-vapid-keys
// Add the output to backend/.env as VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:you@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn("VAPID keys missing — push notifications are disabled until .env is set.");
}

async function sendPushToUser(userId, payload) {
  try {
    if (!process.env.VAPID_PUBLIC_KEY) return;

    // toJSON() strips pushSubscriptions, so use .toObject() via lean() to get the raw field
    const user = await User.findById(userId).lean();
    if (!user || !user.pushSubscriptions?.length) return;

    const results = await Promise.allSettled(
      user.pushSubscriptions.map((sub) => webpush.sendNotification(sub, JSON.stringify(payload)))
    );

    const deadEndpoints = [];
    results.forEach((result, i) => {
      if (
        result.status === "rejected" &&
        (result.reason?.statusCode === 410 || result.reason?.statusCode === 404)
      ) {
        deadEndpoints.push(user.pushSubscriptions[i].endpoint);
      }
    });

    if (deadEndpoints.length) {
      await User.findByIdAndUpdate(userId, {
        $pull: { pushSubscriptions: { endpoint: { $in: deadEndpoints } } },
      });
    }
  } catch (err) {
    console.error("sendPushToUser error:", err.message);
  }
}

module.exports = { sendPushToUser };