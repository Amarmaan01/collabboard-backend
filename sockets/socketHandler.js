const Room = require("../models/Room");

// Track online users per room: { roomId: Map<socketId, userInfo> }
const roomUsers = new Map();

const getParticipantsList = (roomId) => {
  const users = roomUsers.get(roomId);
  if (!users) return [];
  return Array.from(users.values());
};

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.id})`);

    // ─── ROOM EVENTS ─────────────────────────────────
    socket.on("room:join", async ({ roomId }) => {
      try {
        socket.join(roomId);
        socket.roomId = roomId;

        // Track user
        if (!roomUsers.has(roomId)) {
          roomUsers.set(roomId, new Map());
        }
        roomUsers.get(roomId).set(socket.id, {
          id: socket.user.id,
          name: socket.user.name,
          socketId: socket.id,
        });

        // Broadcast updated participants
        const participants = getParticipantsList(roomId);
        io.to(roomId).emit("user:join", {
          user: socket.user,
          participants,
        });

        // Load room data for the joining user
        const room = await Room.findOne({ roomId })
          .populate("host", "name email")
          .populate("participants", "name email");

        if (room) {
          socket.emit("room:data", {
            layers: room.layers,
            chatHistory: room.chatHistory,
            eventLog: room.eventLog,
            host: room.host,
          });
        }

        console.log(`${socket.user.name} joined room ${roomId}`);
      } catch (error) {
        console.error("room:join error:", error);
      }
    });

    socket.on("room:leave", () => {
      handleLeave(socket, io);
    });

    // ─── DRAWING EVENTS ──────────────────────────────
    socket.on("drawing:start", (data) => {
      socket.to(socket.roomId).emit("drawing:start", {
        ...data,
        userId: socket.user.id,
      });
    });

    socket.on("drawing:move", (data) => {
      socket.to(socket.roomId).emit("drawing:move", {
        ...data,
        userId: socket.user.id,
      });
    });

    socket.on("drawing:end", async (data) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      // Broadcast to others
      socket.to(roomId).emit("drawing:end", {
        ...data,
        userId: socket.user.id,
      });

      // Persist stroke to database
      try {
        await Room.findOneAndUpdate(
          { roomId },
          {
            $push: {
              "layers.drawingLayer": data,
              eventLog: {
                eventType: "drawing:end",
                payload: data,
                userId: socket.user.id,
                timestamp: new Date(),
              },
            },
          }
        );
      } catch (error) {
        console.error("drawing:end persist error:", error);
      }
    });

    socket.on("history:undo", async ({ strokeId }) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      socket.to(roomId).emit("history:undo", { strokeId });

      try {
        await Room.findOneAndUpdate(
          { roomId },
          {
            $pull: { "layers.drawingLayer": { id: strokeId } },
            $push: {
              eventLog: {
                eventType: "history:undo",
                payload: { strokeId },
                userId: socket.user.id,
                timestamp: new Date(),
              },
            },
          }
        );
      } catch (error) {
        console.error("history:undo error:", error);
      }
    });

    socket.on("history:redo", async (data) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      socket.to(roomId).emit("history:redo", data);

      try {
        await Room.findOneAndUpdate(
          { roomId },
          {
            $push: {
              "layers.drawingLayer": data,
              eventLog: {
                eventType: "history:redo",
                payload: data,
                userId: socket.user.id,
                timestamp: new Date(),
              },
            },
          }
        );
      } catch (error) {
        console.error("history:redo error:", error);
      }
    });

    socket.on("board:clear", async ({ roomId }) => {
      // Only host can clear — verify on frontend too
      try {
        const room = await Room.findOne({ roomId });
        if (!room || room.host.toString() !== socket.user.id) {
          return socket.emit("error", {
            message: "Only the host can clear the board",
          });
        }

        await Room.findOneAndUpdate(
          { roomId },
          {
            $set: { "layers.drawingLayer": [], "layers.textLayer": [] },
            $push: {
              eventLog: {
                eventType: "board:clear",
                payload: {},
                userId: socket.user.id,
                timestamp: new Date(),
              },
            },
          }
        );

        io.to(roomId).emit("board:clear");
      } catch (error) {
        console.error("board:clear error:", error);
      }
    });

    // ─── AI EVENTS ───────────────────────────────────
    socket.on("ai:generate", async (data) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      // Store AI elements in textLayer
      try {
        if (data.elements && Array.isArray(data.elements)) {
          await Room.findOneAndUpdate(
            { roomId },
            {
              $push: {
                "layers.textLayer": { $each: data.elements },
                eventLog: {
                  eventType: "ai:generate",
                  payload: data,
                  userId: socket.user.id,
                  timestamp: new Date(),
                },
              },
            }
          );
        }
        io.to(roomId).emit("ai:generate", data);
      } catch (error) {
        console.error("ai:generate error:", error);
      }
    });

    // ─── STICKY NOTE EVENTS ──────────────────────────
    socket.on("sticky:create", async (note) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      socket.to(roomId).emit("sticky:create", note);

      try {
        await Room.findOneAndUpdate(
          { roomId },
          {
            $push: {
              "layers.textLayer": note,
              eventLog: {
                eventType: "sticky:create",
                payload: note,
                userId: socket.user.id,
                timestamp: new Date(),
              },
            },
          }
        );
      } catch (error) {
        console.error("sticky:create error:", error);
      }
    });

    socket.on("sticky:move", async ({ id, x, y }) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      socket.to(roomId).emit("sticky:move", { id, x, y });

      try {
        await Room.findOneAndUpdate(
          { roomId, "layers.textLayer.id": id },
          {
            $set: {
              "layers.textLayer.$.x": x,
              "layers.textLayer.$.y": y,
            },
          }
        );
      } catch (error) {
        console.error("sticky:move error:", error);
      }
    });

    socket.on("sticky:edit", async ({ id, text }) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      socket.to(roomId).emit("sticky:edit", { id, text });

      try {
        await Room.findOneAndUpdate(
          { roomId, "layers.textLayer.id": id },
          { $set: { "layers.textLayer.$.text": text } }
        );
      } catch (error) {
        console.error("sticky:edit error:", error);
      }
    });

    socket.on("sticky:delete", async ({ id }) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      socket.to(roomId).emit("sticky:delete", { id });

      try {
        await Room.findOneAndUpdate(
          { roomId },
          {
            $pull: { "layers.textLayer": { id } },
            $push: {
              eventLog: {
                eventType: "sticky:delete",
                payload: { id },
                userId: socket.user.id,
                timestamp: new Date(),
              },
            },
          }
        );
      } catch (error) {
        console.error("sticky:delete error:", error);
      }
    });

    // ─── IMAGE EVENTS ────────────────────────────────
    socket.on("image:add", async (imageData) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      socket.to(roomId).emit("image:add", imageData);

      try {
        await Room.findOneAndUpdate(
          { roomId },
          {
            $push: {
              "layers.fileLayer": imageData,
              eventLog: {
                eventType: "image:add",
                payload: imageData,
                userId: socket.user.id,
                timestamp: new Date(),
              },
            },
          }
        );
      } catch (error) {
        console.error("image:add error:", error);
      }
    });

    // ─── LASER POINTER EVENTS ────────────────────────
    socket.on("laser:move", ({ point }) => {
      const roomId = socket.roomId;
      if (!roomId) return;
      socket.to(roomId).emit("laser:move", {
        userId: socket.user.id,
        username: socket.user.name,
        point,
      });
    });

    socket.on("laser:stop", () => {
      const roomId = socket.roomId;
      if (!roomId) return;
      socket.to(roomId).emit("laser:stop", {
        userId: socket.user.id,
      });
    });

    // ─── CHAT EVENTS ─────────────────────────────────
    socket.on("chat:send", async ({ message }) => {
      const roomId = socket.roomId;
      if (!roomId || !message) return;

      const chatMsg = {
        userId: socket.user.id,
        username: socket.user.name,
        message,
        timestamp: new Date(),
      };

      io.to(roomId).emit("chat:receive", chatMsg);

      // Persist to chatHistory (limit 500)
      try {
        const room = await Room.findOne({ roomId });
        if (room) {
          room.chatHistory.push(chatMsg);
          if (room.chatHistory.length > 500) {
            room.chatHistory = room.chatHistory.slice(-500);
          }
          await room.save();
        }
      } catch (error) {
        console.error("chat:send persist error:", error);
      }
    });

    socket.on("user:typing", ({ isTyping }) => {
      if (!socket.roomId) return;
      socket.to(socket.roomId).emit("user:typing", {
        user: socket.user,
        isTyping,
      });
    });

    // ─── DISCONNECT ──────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.user.name}`);
      handleLeave(socket, io);
    });
  });
};

async function handleLeave(socket, io) {
  const roomId = socket.roomId;
  if (!roomId) return;

  socket.leave(roomId);

  // Remove from tracking
  if (roomUsers.has(roomId)) {
    roomUsers.get(roomId).delete(socket.id);

    const participants = getParticipantsList(roomId);

    io.to(roomId).emit("user:leave", {
      user: socket.user,
      participants,
    });

    // If no participants left, mark room inactive
    if (participants.length === 0) {
      roomUsers.delete(roomId);
      try {
        await Room.findOneAndUpdate({ roomId }, { isActive: false });
      } catch (error) {
        console.error("Room deactivation error:", error);
      }
    }
  }

  socket.roomId = null;
}
