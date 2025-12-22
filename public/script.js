const socket = io();

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

const ice = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

function log(msg, who = "Stranger") {
  const div = document.createElement("div");
  div.textContent = `${who}: ${msg}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

startBtn.onclick = async () => {
  startBtn.disabled = true;
  nextBtn.disabled = false;
  stopBtn.disabled = false;
  status.textContent = "Looking for someone...";

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  socket.emit("find-partner");
};

nextBtn.onclick = () => {
  cleanup();
  socket.emit("next");
  socket.emit("find-partner");
  status.textContent = "Looking for someone...";
};

stopBtn.onclick = () => {
  cleanup();
  socket.disconnect();
  location.reload();
};

function cleanup() {
  if (peer) peer.close();
  peer = null;
  remoteVideo.srcObject = null;
  messages.innerHTML = "";
}

socket.on("partner-found", async () => {
  status.textContent = "Connected";
  messageInput.disabled = false;

  peer = new RTCPeerConnection(ice);

  localStream.getTracks().forEach(t => peer.addTrack(t, localStream));

  peer.ontrack = e => remoteVideo.srcObject = e.streams[0];

  peer.onicecandidate = e => {
    if (e.candidate) socket.emit("signal", { candidate: e.candidate });
  };

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  socket.emit("signal", { offer });
});

socket.on("signal", async data => {
  if (!peer) peer = new RTCPeerConnection(ice);

  if (data.offer) {
    await peer.setRemoteDescription(data.offer);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("signal", { answer });
  }

  if (data.answer) await peer.setRemoteDescription(data.answer);
  if (data.candidate) await peer.addIceCandidate(data.candidate);
});

messageInput.onkeydown = e => {
  if (e.key === "Enter" && messageInput.value.trim()) {
    log(messageInput.value, "You");
    socket.emit("chat-message", messageInput.value);
    messageInput.value = "";
  }
};

socket.on("chat-message", msg => log(msg));

socket.on("partner-left", () => {
  status.textContent = "Stranger disconnected";
  cleanup();
});
