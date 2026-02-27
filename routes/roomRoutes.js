const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const {
  createRoom,
  joinRoom,
  getRoom,
  getRecentRooms,
  uploadImage,
  getRoomStats,
} = require("../controllers/roomController");
const { verifyToken } = require("../middleware/auth");

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error("Only image files are allowed"));
  },
});

router.use(verifyToken);

router.post("/create", createRoom);
router.post("/join", joinRoom);
router.post("/upload-image", upload.single("image"), uploadImage);
router.get("/recent", getRecentRooms);
router.get("/stats", getRoomStats);
router.get("/:roomId", getRoom);

module.exports = router;
