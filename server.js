const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let waitingQueue = [];

function removeFromQueue(socket) {
  waitingQueue = waitingQueue.filter(s => s.id !== socket.id);
}

io.on("connection", socket => {
  console.log("User connected:", socket.id);

  socket.partner = null;

  socket.on("find-partner", () => {
    removeFromQueue(socket);

    const partner = waitingQueue.find(s => s.id !== socket.id);

    if (partner) {
      removeFromQueue(partner);

      socket.partner = partner;
      partner.partner = socket;

      socket.emit("partner-found");
      partner.emit("partner-found");
    } else {
      waitingQueue.push(socket);
      socket.emit("waiting");
    }
  });

  // WebRTC signaling
  socket.on("signal", data => {
    if (socket.partner) {
      socket.partner.emit("signal", data);
    }
  });

  // Text chat
  socket.on("chat-message", msg => {
    if (socket.partner) {
      socket.partner.emit("chat-message", msg);
    }
  });

  // Next button
  socket.on("next", () => {
    if (socket.partner) {
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
      socket.partner = null;
    }
    socket.partner = null;
    removeFromQueue(socket);
  });

  socket.on("disconnect", () => {
    if (socket.partner) {
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
    }
    removeFromQueue(socket);
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
