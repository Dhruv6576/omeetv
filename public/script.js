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
const statusDot = document.getElementById("statusDot"); // New Dot element

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const waitMsg = document.getElementById("waitMsg"); // New Wait Message

const messages = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn"); // New Send Button

const onlineCount = document.getElementById("onlineCount");

// ===== STATE =====
let localStream = null;
let peer = null;
let myRole = null;
let myName = null;

// ===== ICE =====
const ice = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// ===== JOIN =====
joinBtn.onclick = () => {
  if (!nameInput.value.trim()) return;

  myName = nameInput.value.trim();
  socket.emit("join", myName);

  nameBox.style.display = "none";
  app.style.display = "block";
};

// ===== START =====
startBtn.onclick = async () => {
  startBtn.disabled = true;
  nextBtn.disabled = false;
  stopBtn.disabled = false;
  status.textContent = "Looking for someone...";
  statusDot.className = "dot"; // Grey

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

// ===== CREATE PEER =====
function createPeer() {
  if (peer) return;

  peer = new RTCPeerConnection(ice);

  localStream.getTracks().forEach(track =>
    peer.addTrack(track, localStream)
  );

  peer.ontrack = e => {
    remoteVideo.srcObject = e.streams[0];
    // Video element will trigger 'play' event which hides waitMsg
  };

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", { candidate: e.candidate });
    }
  };
}

// ===== VIDEO UI EVENTS =====
// Hides "Waiting..." text when video actually starts playing
remoteVideo.onplay = () => {
    waitMsg.style.display = "none";
};

// Shows "Waiting..." text when video stops/empties
remoteVideo.onpause = () => {
    waitMsg.style.display = "flex";
};

// ===== MATCH FOUND =====
socket.on("partner-found", ({ role, partnerName }) => {
  myRole = role;
  status.textContent = `Talking to: ${partnerName}`;
  statusDot.className = "dot active"; // Green
  messageInput.disabled = false;
  messageInput.focus();

  createPeer();

  if (myRole === "caller") {
    peer.createOffer().then(offer => {
      peer.setLocalDescription(offer);
      socket.emit("signal", { offer });
    });
  }
});

// ===== SIGNAL =====
socket.on("signal", async data => {
  createPeer(); // Ensure peer exists

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

// ===== CHAT =====
const sendMessage = () => {
    if (messageInput.value.trim()) {
        const msg = messageInput.value.trim();
        messages.innerHTML += `<div style="text-align: right; color: #a855f7;"><b>You:</b> ${msg}</div>`;
        socket.emit("chat-message", msg);
        messageInput.value = "";
        messages.scrollTop = messages.scrollHeight; // Auto scroll
    }
};

messageInput.onkeydown = e => {
  if (e.key === "Enter") sendMessage();
};

sendBtn.onclick = sendMessage; // Click listener for button

socket.on("chat-message", data => {
  messages.innerHTML += `<div><b>${data.from}:</b> ${data.text}</div>`;
  messages.scrollTop = messages.scrollHeight; // Auto scroll
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
  // This explicitly shows the waiting text
  waitMsg.style.display = "flex"; 
  
  messages.innerHTML = `<div class="system-msg">Chat cleared. Searching for new partner...</div>`;
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