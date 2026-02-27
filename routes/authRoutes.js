const express = require("express");
const passport = require("passport");
const router = express.Router();
const {
  register,
  login,
  logout,
  getMe,
  googleCallback,
  updateProfile,
  changePassword,
  updateTheme,
} = require("../controllers/authController");
const { verifyToken } = require("../middleware/auth");

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", verifyToken, getMe);
router.put("/profile", verifyToken, updateProfile);
router.put("/password", verifyToken, changePassword);
router.put("/theme", verifyToken, updateTheme);

// Google OAuth
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: process.env.CLIENT_URL + "/login?error=google_failed",
    session: false,
  }),
  googleCallback
);

module.exports = router;
