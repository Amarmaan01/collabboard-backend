const User = require("../models/User");
const { generateToken } = require("../utils/token");
const { cookieOptions } = require("../config/cookie");

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    res.cookie("token", token, cookieOptions);

    res.status(201).json({
      message: "Registration successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        themePreference: user.themePreference,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id);
    res.cookie("token", token, cookieOptions);

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        themePreference: user.themePreference,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/logout
const logout = (req, res) => {
  res.cookie("token", "", { ...cookieOptions, maxAge: 0 });
  res.json({ message: "Logged out successfully" });
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        themePreference: req.user.themePreference,
      },
    });
  } catch (error) {
    console.error("GetMe error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Google OAuth callback handler
const googleCallback = async (req, res) => {
  try {
    const token = generateToken(req.user._id);
    res.cookie("token", token, cookieOptions);
    res.redirect(process.env.CLIENT_URL + "/dashboard");
  } catch (error) {
    console.error("Google callback error:", error);
    res.redirect(process.env.CLIENT_URL + "/login?error=google_failed");
  }
};

// PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name: name.trim() },
      { new: true }
    );
    res.json({
      message: "Profile updated",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        themePreference: user.themePreference,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/auth/password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }
    const user = await User.findById(req.user._id).select("+password");
    if (!user.password) {
      return res.status(400).json({ message: "OAuth accounts cannot change password here" });
    }
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/auth/theme
const updateTheme = async (req, res) => {
  try {
    const { theme } = req.body;
    if (!theme || !["dark", "light"].includes(theme)) {
      return res.status(400).json({ message: "Valid theme is required (dark or light)" });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { themePreference: theme },
      { new: true }
    );
    res.json({
      message: "Theme updated",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        themePreference: user.themePreference,
      },
    });
  } catch (error) {
    console.error("Update theme error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { register, login, logout, getMe, googleCallback, updateProfile, changePassword, updateTheme };
