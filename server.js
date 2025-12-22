const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let queue = [];

function removeFromQueue(socket) {
  queue = queue.filter(s => s.id !== socket.id);
}

io.on("connection", socket => {
  socket.partner = null;
  socket.username = null;

  console.log("Connected:", socket.id);

  socket.on("join", username => {
    socket.username = username;
  });

  socket.on("find-partner", () => {
    removeFromQueue(socket);

    const partner = queue.find(s => s.id !== socket.id);

    if (partner) {
      removeFromQueue(partner);

      socket.partner = partner;
      partner.partner = socket;

      // IMPORTANT: decide caller / callee
      socket.emit("partner-found", {
        role: "caller",
        partnerName: partner.username
      });

      partner.emit("partner-found", {
        role: "callee",
        partnerName: socket.username
      });
    } else {
      queue.push(socket);
      socket.emit("waiting");
    }
  });

  socket.on("stop", () => {
  if (socket.partner) {
    socket.partner.emit("partner-left");
    socket.partner.partner = null;
  }
  socket.partner = null;
  removeFromQueue(socket);
});


  socket.on("signal", data => {
    if (socket.partner) {
      socket.partner.emit("signal", data);
    }
  });

  socket.on("chat-message", msg => {
    if (socket.partner) {
      socket.partner.emit("chat-message", {
        from: socket.username,
        text: msg
      });
    }
  });

  socket.on("next", () => {
    if (socket.partner) {
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
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
