const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const dotenv = require("dotenv");
const session = require("express-session");
const passport = require("passport");
const path = require("path");

dotenv.config();

// Initialize passport Google strategy
require("./config/passport");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const roomRoutes = require("./routes/roomRoutes");
const aiRoutes = require("./routes/aiRoutes");
const socketAuth = require("./middleware/socketAuth");
const socketHandler = require("./sockets/socketHandler");

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true,
  },
});

// Socket authentication middleware
io.use(socketAuth);

// Initialize socket handlers
socketHandler(io);

// Express middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("dev"));
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Session for passport OAuth flow
app.use(
  session({
    secret: process.env.SESSION_SECRET || "collabboard_session",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 60000,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/ai", aiRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

// Start server
const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 CollabBoard AI server running on port ${PORT}`);
    console.log(`📡 Socket.io ready`);
    console.log(`🔗 Client URL: ${process.env.CLIENT_URL}\n`);
  });
});

module.exports = { app, server, io };
