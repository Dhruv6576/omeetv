const socket = io();

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

let localStream;
let peer;
let myName;
let myRole; // caller or callee

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
  status.textContent = "Looking for someone...";
  startBtn.disabled = true;
  nextBtn.disabled = false;
  stopBtn.disabled = false;

  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  localVideo.srcObject = localStream;

  socket.emit("find-partner");
};

// ===== PEER =====
function createPeer() {
  peer = new RTCPeerConnection(ice);

  localStream.getTracks().forEach(t =>
    peer.addTrack(t, localStream)
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

// ===== MATCHED =====
socket.on("partner-found", async ({ role, partnerName }) => {
  myRole = role;
  status.textContent = `Connected with ${partnerName}`;
  messageInput.disabled = false;

  createPeer();

  // ONLY CALLER CREATES OFFER
  if (myRole === "caller") {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("signal", { offer });
  }
});

// ===== SIGNAL =====
socket.on("signal", async data => {
  if (!peer) createPeer();

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
  cleanup();
  socket.emit("next");
  socket.emit("find-partner");
  status.textContent = "Looking for someone...";
};

// ===== CLEANUP =====
function cleanup() {
  if (peer) peer.close();
  peer = null;
  remoteVideo.srcObject = null;
  messages.innerHTML = "";
}

// ===== DISCONNECT =====
socket.on("partner-left", () => {
  status.textContent = "Stranger disconnected";
  cleanup();
});
