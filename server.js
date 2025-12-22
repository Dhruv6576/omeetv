const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve files from the "public" folder
app.use(express.static("public"));

// ===== STATE =====
let waitingQueue = [];
let onlineUsers = 0;

// ===== HELPERS =====
function removeFromQueue(socket) {
  waitingQueue = waitingQueue.filter(s => s.id !== socket.id);
}

function broadcastOnlineCount() {
  io.emit("online-count", onlineUsers);
}

// ===== SOCKET LOGIC =====
io.on("connection", socket => {
  onlineUsers++;
  broadcastOnlineCount();

  socket.username = null;
  socket.partner = null;

  console.log("Connected:", socket.id);

  // ---- USER JOIN ----
  socket.on("join", username => {
    socket.username = username;
  });

  // ---- FIND PARTNER ----
  socket.on("find-partner", () => {
    // Remove self from queue if already there
    removeFromQueue(socket);

    // Find first available partner (not self)
    const partner = waitingQueue.find(s => s.id !== socket.id);

    if (partner) {
      // Remove partner from queue
      removeFromQueue(partner);

      // Pair them
      socket.partner = partner;
      partner.partner = socket;

      // Decide roles to avoid WebRTC glare
      socket.emit("partner-found", {
        role: "caller",
        partnerName: partner.username || "Stranger"
      });

      partner.emit("partner-found", {
        role: "callee",
        partnerName: socket.username || "Stranger"
      });
    } else {
      // No partner yet → wait
      waitingQueue.push(socket);
      socket.emit("waiting");
    }
  });

  // ---- WEBRTC SIGNALING ----
  socket.on("signal", data => {
    if (socket.partner) {
      socket.partner.emit("signal", data);
    }
  });

  // ---- CHAT ----
  socket.on("chat-message", msg => {
    if (socket.partner) {
      socket.partner.emit("chat-message", {
        from: socket.username || "Stranger",
        text: msg
      });
    }
  });

  // ---- NEXT ----
  socket.on("next", () => {
    if (socket.partner) {
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
    }

    socket.partner = null;
    removeFromQueue(socket);
  });

  // ---- STOP ----
  socket.on("stop", () => {
    if (socket.partner) {
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
    }

    socket.partner = null;
    removeFromQueue(socket);
  });

  // ---- DISCONNECT ----
  socket.on("disconnect", () => {
    onlineUsers--;
    broadcastOnlineCount();

    if (socket.partner) {
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
    }

    removeFromQueue(socket);
    console.log("Disconnected:", socket.id);
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});