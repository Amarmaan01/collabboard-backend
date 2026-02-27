const Room = require("../models/Room");
const { nanoid } = require("nanoid");

// POST /api/rooms/create
const createRoom = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 4) {
      return res.status(400).json({ message: "Password is required (min 4 characters)" });
    }

    const roomId = nanoid(10);

    const room = await Room.create({
      roomId,
      host: req.user._id,
      participants: [req.user._id],
      password,
    });

    const populated = await Room.findById(room._id)
      .populate("host", "name email")
      .populate("participants", "name email");

    res.status(201).json({
      message: "Room created",
      room: populated,
    });
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/rooms/join
const joinRoom = async (req, res) => {
  try {
    const { roomId, password } = req.body;

    if (!roomId) {
      return res.status(400).json({ message: "Room ID is required" });
    }

    if (!password) {
      return res.status(400).json({ message: "Room password is required" });
    }

    const room = await Room.findOne({ roomId });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (!room.isActive) {
      return res.status(400).json({ message: "Room is no longer active" });
    }

    // Verify password
    const isMatch = await room.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect room password" });
    }

    // Add participant if not already in
    const isAlreadyParticipant = room.participants.some(
      (p) => p.toString() === req.user._id.toString()
    );

    if (!isAlreadyParticipant) {
      room.participants.push(req.user._id);
      await room.save();
    }

    const populated = await Room.findById(room._id)
      .populate("host", "name email")
      .populate("participants", "name email");

    res.json({
      message: "Joined room",
      room: populated,
    });
  } catch (error) {
    console.error("Join room error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/rooms/:roomId
const getRoom = async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId })
      .populate("host", "name email")
      .populate("participants", "name email");

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    res.json({ room });
  } catch (error) {
    console.error("Get room error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/rooms/recent
const getRecentRooms = async (req, res) => {
  try {
    const rooms = await Room.find({
      participants: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("host", "name email")
      .populate("participants", "name email");

    res.json({ rooms });
  } catch (error) {
    console.error("Get recent rooms error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/rooms/upload-image
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const { roomId } = req.body;
    if (!roomId) {
      return res.status(400).json({ message: "Room ID is required" });
    }

    const baseUrl = process.env.BASE_URL || "http://localhost:5001";
    const imageData = {
      id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type: "image",
      src: `${baseUrl}/uploads/${req.file.filename}`,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 300,
      height: 300,
      originalName: req.file.originalname,
      userId: req.user._id,
      timestamp: Date.now(),
    };

    // Persist to fileLayer
    await Room.findOneAndUpdate(
      { roomId },
      { $push: { "layers.fileLayer": imageData } }
    );

    res.json({ image: imageData });
  } catch (error) {
    console.error("Upload image error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/rooms/stats
const getRoomStats = async (req, res) => {
  try {
    const totalRooms = await Room.countDocuments({ participants: req.user._id });
    const activeRooms = await Room.countDocuments({ participants: req.user._id, isActive: true });

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeek = await Room.countDocuments({
      participants: req.user._id,
      createdAt: { $gte: oneWeekAgo },
    });

    res.json({ totalRooms, activeRooms, thisWeek });
  } catch (error) {
    console.error("Room stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { createRoom, joinRoom, getRoom, getRecentRooms, uploadImage, getRoomStats };
