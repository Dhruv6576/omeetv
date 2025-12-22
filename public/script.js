const socket = io();

// ===== ELEMENTS =====
const nameBox = document.getElementById("nameBox");
const joinBtn = document.getElementById("joinBtn");
const nameInput = document.getElementById("nameInput");

const app = document.getElementById("app");

const startBtn = document.getElementById("startBtn");
const nextBtn = document.getElementById("nextBtn");
const stopBtn = document.getElementById("stopBtn");
const status = document.getElementById("status");
const statusDot = document.getElementById("statusDot"); 

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const waitMsg = document.getElementById("waitMsg"); 

// NEW: Elements for changing Names
const localNameLabel = document.getElementById("localName");
const remoteNameLabel = document.getElementById("remoteName");

const messages = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn"); 

const onlineCount = document.getElementById("onlineCount");

// ===== STATE =====
let localStream = null;
let peer = null;
let myRole = null;
let myName = null;

// ===== ICE SERVERS =====
const ice = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// ===== JOIN =====
joinBtn.onclick = () => {
  if (!nameInput.value.trim()) return;

  myName = nameInput.value.trim();
  socket.emit("join", myName);

  // UPDATE UI: Set your own name on the video label
  localNameLabel.textContent = myName + " (You)";

  nameBox.style.display = "none";
  app.style.display = "block";
  
  // FIX: Force scroll to top (Video Section) on mobile
  window.scrollTo(0, 0);
};

// ===== START =====
startBtn.onclick = async () => {
  startBtn.disabled = true;
  nextBtn.disabled = false;
  stopBtn.disabled = false;
  status.textContent = "Looking for someone...";
  statusDot.className = "dot"; 

  if (!localStream) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });
        localVideo.srcObject = localStream;
    } catch (err) {
        alert("Please allow camera/microphone access to use the app.");
        window.location.reload();
    }
  }

  socket.emit("find-partner");
};

// ===== CREATE PEER CONNECTION =====
function createPeer() {
  if (peer) return;

  peer = new RTCPeerConnection(ice);

  localStream.getTracks().forEach(track =>
    peer.addTrack(track, localStream)
  );

  peer.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
  };

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", { candidate: e.candidate });
    }
  };
}

// ===== VIDEO UI EVENTS =====
remoteVideo.onplay = () => {
    waitMsg.style.display = "none";
};

remoteVideo.onpause = () => {
    waitMsg.style.display = "flex";
};

// ===== MATCH FOUND =====
socket.on("partner-found", ({ role, partnerName }) => {
  myRole = role;
  status.textContent = `Talking to: ${partnerName}`;
  
  // UPDATE UI: Set Stranger's name on the video label
  remoteNameLabel.textContent = partnerName;
  
  statusDot.className = "dot active"; 
  messageInput.disabled = false;
  
  // FIX: REMOVED messageInput.focus() to prevent mobile keyboard
  // messageInput.focus(); <--- DELETED THIS

  createPeer();

  if (myRole === "caller") {
    peer.createOffer().then(offer => {
      peer.setLocalDescription(offer);
      socket.emit("signal", { offer });
    });
  }
});

// ===== SIGNALING =====
socket.on("signal", async data => {
  createPeer(); 

  if (data.offer) {
    await peer.setRemoteDescription(data.offer);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("signal", { answer });
  }

  if (data.answer) {
    await peer.setRemoteDescription(data.answer);
  }

  if (data.candidate) {
    await peer.addIceCandidate(data.candidate);
  }
});

// ===== CHAT FUNCTIONS =====

// Helper to scroll to bottom smoothly
const scrollToBottom = () => {
    messages.scrollTop = messages.scrollHeight;
};

// Helper to append message safely
const appendMessage = (html) => {
    messages.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
};

const sendMessage = () => {
    const text = messageInput.value.trim();
    if (text) {
        // User's own message (Right side)
        appendMessage(`<div class="msg-box my-msg"><b>You:</b> ${text}</div>`);
        
        socket.emit("chat-message", text);
        messageInput.value = "";
    }
};

messageInput.onkeydown = e => {
  if (e.key === "Enter") sendMessage();
};

sendBtn.onclick = sendMessage; 

socket.on("chat-message", data => {
  // Stranger's message (Left side) - Uses the name sent from server
  appendMessage(`<div class="msg-box stranger-msg"><b>${data.from}:</b> ${data.text}</div>`);
});

// ===== NEXT =====
nextBtn.onclick = () => {
  socket.emit("next");
  resetCall();
  status.textContent = "Looking for someone...";
  statusDot.className = "dot";
  socket.emit("find-partner");
};

// ===== STOP =====
stopBtn.onclick = () => {
  socket.emit("stop");
  fullReset();
};

// ===== PARTNER LEFT =====
socket.on("partner-left", () => {
  status.textContent = "Stranger disconnected";
  statusDot.className = "dot";
  resetCall();
});

// ===== ONLINE COUNT =====
socket.on("online-count", count => {
  onlineCount.textContent = `Online: ${count}`;
});

// ===== HELPERS =====
function resetCall() {
  if (peer) {
    peer.close();
    peer = null;
  }
  remoteVideo.srcObject = null;
  waitMsg.style.display = "flex"; 
  
  // RESET UI: Change name back to "Stranger"
  remoteNameLabel.textContent = "Stranger";

  // Clear chat but keep scrolling active
  messages.innerHTML = `<div class="system-msg">Chat cleared. Searching...</div>`;
  messageInput.disabled = true;
}

function fullReset() {
  resetCall();

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }

  localVideo.srcObject = null;
  status.textContent = "Click Start";
  
  startBtn.disabled = false;
  nextBtn.disabled = true;
  stopBtn.disabled = true;
  
  messages.innerHTML = `<div class="system-msg">Welcome! Press Start to find a partner.</div>`;
}