const jwt = require("jsonwebtoken");

/**
 * Generates a JWT for a user and sets it as an httpOnly cookie on the response.
 * Using an httpOnly cookie (rather than localStorage) protects the token from XSS.
 */
const generateToken = (userId, res) => {
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn,
  });

  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: isProduction,
    // Same-origin setup (backend serves the built frontend / same domain),
    // so this never needs to be "none" — that value is only for genuine
    // cross-site cookies and, on top of not being needed here, "None"
    // cookies get inconsistent treatment on iOS Safari (especially in
    // installed/PWA/home-screen mode): dropped or not persisted reliably
    // across backgrounding. "Lax" is both correct for same-origin and far
    // more robust on mobile.
    sameSite: "lax",
    maxAge: parseExpiresInToMs(expiresIn),
  });

  return token;
};

// Keeps the cookie's maxAge in sync with JWT_EXPIRES_IN instead of a
// separately hardcoded "7 days" that silently drifts if you ever change
// the env var — cookie would then outlive or expire before the token does.
function parseExpiresInToMs(expiresIn) {
  if (typeof expiresIn === "number") return expiresIn * 1000;

  const match = /^(\d+)([smhd])$/.exec(expiresIn.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000; // fallback: 7 days

  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return value * unitMs;
}

module.exports = generateToken;