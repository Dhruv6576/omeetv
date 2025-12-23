
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// ===== CONFIG =====
const SECRET_CODE = "dcef7281a"; 
const CREATOR_NAME = "Dhruv";   

let users = {}; 
let waitingQueue = [];

function removeFromQueue(socketId) {
  waitingQueue = waitingQueue.filter(s => s.id !== socketId);
}

function broadcastUserList() {
  const allUsers = Object.values(users);
  const creators = allUsers.filter(u => u.isCreator);
  const others = allUsers.filter(u => !u.isCreator);

  // Shuffle "others"
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }

  const sortedList = [...creators, ...others];
  io.emit("update-user-list", sortedList);
}

io.on("connection", socket => {
  console.log("Connected:", socket.id);

  users[socket.id] = { 
    id: socket.id, 
    name: null, 
    status: 'idle', 
    joinTime: Date.now(), 
    isCreator: false 
  };

  socket.on("join", inputName => {
    let displayName = inputName;
    let isCreator = false;

    if (inputName === SECRET_CODE) {
      displayName = CREATOR_NAME;
      isCreator = true;
    }

    users[socket.id].name = displayName;
    users[socket.id].isCreator = isCreator;
    users[socket.id].status = 'searching'; 

    socket.emit("join-success", { name: displayName, isCreator });
    broadcastUserList();
    io.emit("online-count", Object.keys(users).length);
  });

  socket.on("find-partner", () => {
    removeFromQueue(socket.id);
    users[socket.id].status = 'searching';
    broadcastUserList(); // ADDED: Update user list when searching

    const partner = waitingQueue.find(s => s.id !== socket.id);

    if (partner) {
      removeFromQueue(partner.id);
      connectUsers(socket, partner);
    } else {
      waitingQueue.push(socket);
      socket.emit("waiting");
    }
  });

  socket.on("direct-connect", (targetId) => {
    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket && users[targetId] && users[targetId].status === 'searching') {
      io.to(targetId).emit("incoming-request", {
        fromId: socket.id,
        fromName: socket.username || users[socket.id].name || "Anonymous"
      });
    } else {
      socket.emit("error-msg", "User is busy or unavailable.");
    }
  });

  socket.on("cancel-request", (targetId) => {
    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      targetSocket.emit("request-cancelled", {
        fromName: users[socket.id].name || "User"
      });
    }
  });

  socket.on("respond-request", ({ requestId, accepted, fromId }) => {
    const senderSocket = io.sockets.sockets.get(fromId);
    if (accepted) {
      if (senderSocket && users[fromId] && users[fromId].status !== 'connected') {
        removeFromQueue(socket.id);
        removeFromQueue(fromId);
        connectUsers(socket, senderSocket);
      } else {
        socket.emit("error-msg", "User is no longer available.");
      }
    } else {
      if (senderSocket) senderSocket.emit("request-declined");
    }
  });

  function connectUsers(userA, userB) {
    userA.partner = userB;
    userB.partner = userA;
    users[userA.id].status = 'connected';
    users[userB.id].status = 'connected';
    broadcastUserList(); // ADDED: Update user list when connected

    userA.emit("partner-found", { 
      role: "caller", 
      partnerName: users[userB.id].name,
      isPartnerCreator: users[userB.id].isCreator
    });
    
    userB.emit("partner-found", { 
      role: "callee", 
      partnerName: users[userA.id].name,
      isPartnerCreator: users[userA.id].isCreator
    });
  }

  socket.on("signal", data => {
    if (socket.partner) socket.partner.emit("signal", data);
  });

  socket.on("chat-message", msg => {
    if (socket.partner) {
      socket.partner.emit("chat-message", { 
        from: users[socket.id].name, 
        text: msg 
      });
    }
  });

  const handleDisconnectPair = () => {
    if (socket.partner) {
      const partner = socket.partner;
      partner.emit("partner-left");
      partner.partner = null;
      if(users[partner.id]) {
        users[partner.id].status = 'searching';
        broadcastUserList(); // ADDED: Update user list when disconnected
      }
    }
    socket.partner = null;
    if(users[socket.id]) {
      users[socket.id].status = 'searching';
      broadcastUserList(); // ADDED: Update user list when disconnected
    }
    removeFromQueue(socket.id);
    broadcastUserList();
  };

  socket.on("next", handleDisconnectPair);
  socket.on("stop", handleDisconnectPair);

  socket.on("disconnect", () => {
    handleDisconnectPair();
    delete users[socket.id];
    broadcastUserList();
    io.emit("online-count", Object.keys(users).length);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
