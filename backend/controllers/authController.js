const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const register = async (req, res) => {
  try {
    const { fullName, username, email, password, inviteCode } = req.body;

    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (process.env.INVITE_CODE) {
      if (!inviteCode || inviteCode.trim() !== process.env.INVITE_CODE) {
        return res.status(403).json({ message: "Invalid or missing invite code" });
      }
    }

    if (process.env.MAX_USERS) {
      const userCount = await User.countDocuments();
      if (userCount >= Number(process.env.MAX_USERS)) {
        return res.status(403).json({ message: "Signups are currently full. Please check back later." });
      }
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
    });
    if (existingUser) {
      return res.status(409).json({ message: "Username or email already in use" });
    }

    const user = await User.create({ fullName, username, email, password });

    generateToken(user._id, res);

    res.status(201).json(user);
  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({ message: "Server error during registration" });
  }
};

const login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({
      $or: [
        { email: emailOrUsername.toLowerCase() },
        { username: emailOrUsername.toLowerCase() },
      ],
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, res);

    res.status(200).json(user);
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Server error during login" });
  }
};

const logout = (req, res) => {
  res.cookie("jwt", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    maxAge: 0,
  });
  res.status(200).json({ message: "Logged out successfully" });
};

const getMe = async (req, res) => {
  res.status(200).json(req.user);
};

module.exports = { register, login, logout, getMe };