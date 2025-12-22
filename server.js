// const express = require("express");
// const http = require("http");
// const { Server } = require("socket.io");

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server);

// // Serve files from the "public" folder
// app.use(express.static("public"));

// // ===== STATE =====
// let users = {}; 
// let waitingQueue = [];

// // ===== HELPERS =====
// function removeFromQueue(socketId) {
//   waitingQueue = waitingQueue.filter(s => s.id !== socketId);
// }

// function broadcastUserList() {
//   const userList = Object.values(users);
//   io.emit("update-user-list", userList);
// }

// // ===== SOCKET LOGIC =====
// io.on("connection", socket => {
//   console.log("Connected:", socket.id);

//   users[socket.id] = { id: socket.id, name: null, status: 'idle' };

//   // ---- USER JOIN ----
//   socket.on("join", username => {
//     socket.username = username;
//     users[socket.id].name = username;
//     // Set to searching (Available) immediately
//     users[socket.id].status = 'searching'; 
//     broadcastUserList();
//     io.emit("online-count", Object.keys(users).length);
//   });

//   // ---- FIND PARTNER (RANDOM) ----
//   socket.on("find-partner", () => {
//     removeFromQueue(socket.id);
//     users[socket.id].status = 'searching';
//     broadcastUserList();

//     const partner = waitingQueue.find(s => s.id !== socket.id);

//     if (partner) {
//       removeFromQueue(partner.id);
//       connectUsers(socket, partner);
//     } else {
//       waitingQueue.push(socket);
//       socket.emit("waiting");
//     }
//   });

//   // ---- DIRECT CONNECT REQUEST (STEP 1) ----
//   socket.on("direct-connect", (targetId) => {
//     const targetSocket = io.sockets.sockets.get(targetId);

//     if (targetSocket && users[targetId] && users[targetId].status === 'searching') {
//       // Send Request to Target
//       io.to(targetId).emit("incoming-request", {
//         fromId: socket.id,
//         fromName: socket.username || "Anonymous"
//       });
//     } else {
//       socket.emit("error-msg", "User is busy or unavailable.");
//     }
//   });

//   // ---- HANDLE REQUEST RESPONSE (STEP 2) ----
//   socket.on("respond-request", ({ requestId, accepted, fromId }) => {
//     const senderSocket = io.sockets.sockets.get(fromId);
    
//     if (accepted) {
//       if (senderSocket && users[fromId] && users[fromId].status !== 'connected') {
//         // Remove both from queue and connect
//         removeFromQueue(socket.id);
//         removeFromQueue(fromId);
        
//         connectUsers(socket, senderSocket);
//       } else {
//         socket.emit("error-msg", "User is no longer available.");
//       }
//     } else {
//       // Declined
//       if (senderSocket) {
//         senderSocket.emit("request-declined");
//       }
//     }
//   });

//   // ---- CONNECT 2 USERS HELPER ----
//   function connectUsers(userA, userB) {
//     userA.partner = userB;
//     userB.partner = userA;

//     users[userA.id].status = 'connected';
//     users[userB.id].status = 'connected';
//     broadcastUserList();

//     userA.emit("partner-found", { role: "caller", partnerName: userB.username || "Stranger" });
//     userB.emit("partner-found", { role: "callee", partnerName: userA.username || "Stranger" });
//   }

//   // ---- WEBRTC SIGNALING ----
//   socket.on("signal", data => {
//     if (socket.partner) {
//       socket.partner.emit("signal", data);
//     }
//   });

//   // ---- CHAT ----
//   socket.on("chat-message", msg => {
//     if (socket.partner) {
//       socket.partner.emit("chat-message", {
//         from: socket.username || "Stranger",
//         text: msg
//       });
//     }
//   });

//   // ---- NEXT / STOP (FIXED) ----
//   const handleDisconnectPair = () => {
//     if (socket.partner) {
//       const partner = socket.partner;
//       partner.emit("partner-left");
//       partner.partner = null;
      
//       // FIX: Set partner back to 'searching' (Available) instead of 'idle'
//       if(users[partner.id]) {
//         users[partner.id].status = 'searching';
//       }
//     }

//     socket.partner = null;
    
//     // FIX: Set self back to 'searching' (Available) instead of 'idle'
//     if(users[socket.id]) {
//       users[socket.id].status = 'searching';
//     }

//     removeFromQueue(socket.id);
//     broadcastUserList();
//   };

//   socket.on("next", handleDisconnectPair);
//   socket.on("stop", handleDisconnectPair);

//   socket.on("disconnect", () => {
//     handleDisconnectPair();
//     delete users[socket.id];
//     broadcastUserList();
//     io.emit("online-count", Object.keys(users).length);
//     console.log("Disconnected:", socket.id);
//   });
// });

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });





const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let users = {}; 
let waitingQueue = [];

function removeFromQueue(socketId) {
  waitingQueue = waitingQueue.filter(s => s.id !== socketId);
}

function broadcastUserList() {
  io.emit("update-user-list", Object.values(users));
}

io.on("connection", socket => {
  console.log("Connected:", socket.id);
  users[socket.id] = { id: socket.id, name: null, status: 'idle' };

  socket.on("join", username => {
    socket.username = username;
    users[socket.id].name = username;
    users[socket.id].status = 'searching'; 
    broadcastUserList();
    io.emit("online-count", Object.keys(users).length);
  });

  socket.on("find-partner", () => {
    removeFromQueue(socket.id);
    users[socket.id].status = 'searching';
    broadcastUserList();

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
        fromName: socket.username || "Anonymous"
      });
    } else {
      socket.emit("error-msg", "User is busy or unavailable.");
    }
  });

  // NEW: HANDLE CANCEL REQUEST
  socket.on("cancel-request", (targetId) => {
    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      targetSocket.emit("request-cancelled", {
        fromName: socket.username || "User"
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
    broadcastUserList();
    userA.emit("partner-found", { role: "caller", partnerName: userB.username || "Stranger" });
    userB.emit("partner-found", { role: "callee", partnerName: userA.username || "Stranger" });
  }

  socket.on("signal", data => {
    if (socket.partner) socket.partner.emit("signal", data);
  });

  socket.on("chat-message", msg => {
    if (socket.partner) socket.partner.emit("chat-message", { from: socket.username || "Stranger", text: msg });
  });

  const handleDisconnectPair = () => {
    if (socket.partner) {
      const partner = socket.partner;
      partner.emit("partner-left");
      partner.partner = null;
      if(users[partner.id]) users[partner.id].status = 'searching';
    }
    socket.partner = null;
    if(users[socket.id]) users[socket.id].status = 'searching';
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