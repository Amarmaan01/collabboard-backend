const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
  layers: {
    drawingLayer: { type: Array, default: [] },
    textLayer: { type: Array, default: [] },
    fileLayer: { type: Array, default: [] },
  },
  chatHistory: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      username: String,
      message: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
  eventLog: [
    {
      eventType: String,
      payload: mongoose.Schema.Types.Mixed,
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
roomSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare entered password with hashed password
roomSchema.methods.comparePassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("Room", roomSchema);
