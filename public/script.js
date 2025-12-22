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

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const messages = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");

const onlineCount = document.getElementById("onlineCount"); // NEW

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

  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    localVideo.srcObject = localStream;
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
  };

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit("signal", { candidate: e.candidate });
    }
  };
}

// ===== MATCH FOUND =====
socket.on("partner-found", ({ role, partnerName }) => {
  myRole = role;
  status.textContent = `Connected with ${partnerName}`;
  messageInput.disabled = false;

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

// ===== CHAT =====
messageInput.onkeydown = e => {
  if (e.key === "Enter" && messageInput.value.trim()) {
    messages.innerHTML += `<div><b>You:</b> ${messageInput.value}</div>`;
    socket.emit("chat-message", messageInput.value);
    messageInput.value = "";
  }
};

socket.on("chat-message", data => {
  messages.innerHTML += `<div><b>${data.from}:</b> ${data.text}</div>`;
});

// ===== NEXT =====
nextBtn.onclick = () => {
  socket.emit("next");
  resetCall();
  status.textContent = "Looking for someone...";
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
  messages.innerHTML = "";
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
}
