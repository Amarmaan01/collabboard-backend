const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Socket.io JWT authentication middleware
const socketAuth = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.cookie
        ?.split("; ")
        .find((c) => c.startsWith("token="))
        ?.split("=")[1];

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error("User not found"));
    }

    socket.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
    };

    next();
  } catch (error) {
    next(new Error("Invalid token"));
  }
};

module.exports = socketAuth;
