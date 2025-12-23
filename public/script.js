const socket = io();

// ===== ELEMENTS =====
const nameBox = document.getElementById("nameBox");
const joinBtn = document.getElementById("joinBtn");
const nameInput = document.getElementById("nameInput");

const app = document.getElementById("app");
const scrollHint = document.getElementById("scrollHint");
const sidebarHint = document.getElementById("sidebarHint");

const startBtn = document.getElementById("startBtn");
const nextBtn = document.getElementById("nextBtn");
const stopBtn = document.getElementById("stopBtn");
const findBtn = document.getElementById("findBtn"); 

const status = document.getElementById("status");
const statusDot = document.getElementById("statusDot"); 

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
// We need the parent wrapper to apply the border
const remoteVideoWrapper = remoteVideo.parentElement; 
const waitMsg = document.getElementById("waitMsg"); 

const localNameLabel = document.getElementById("localName");
const remoteNameLabel = document.getElementById("remoteName");

const messages = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn"); 

const onlineCount = document.getElementById("onlineCount");

// SIDEBAR & MODAL
const userSidebar = document.getElementById("userSidebar");
const closeSidebar = document.getElementById("closeSidebar");
const userListContainer = document.getElementById("userList");

const requestModal = document.getElementById("requestModal");
const requesterName = document.getElementById("requesterName");
const acceptBtn = document.getElementById("acceptBtn");
const declineBtn = document.getElementById("declineBtn");

const outgoingModal = document.getElementById("outgoingModal");
const outgoingTargetName = document.getElementById("outgoingTargetName");
const cancelRequestBtn = document.getElementById("cancelRequestBtn");

// ===== STATE =====
let localStream = null;
let peer = null;
let myRole = null;
let myName = null;
let incomingRequestId = null; 
let outgoingRequestTargetId = null;

const ice = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// ===== HELPER: GET MEDIA =====
async function getMedia() {
  if (localStream) return localStream;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream = stream;
    localVideo.srcObject = stream;
    return stream;
  } catch (err) {
    console.error("Camera Error:", err);
    alert("Please allow camera access to connect.");
    return null;
  }
}

// ===== HELPER: FORMAT TIME =====
function formatTime(ms) {
  if (isNaN(ms) || ms < 0) return "0:00";
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ===== LIVE TIMER =====
setInterval(() => {
  const timers = document.querySelectorAll('.u-timer');
  const now = Date.now();
  timers.forEach(timer => {
    const joinTime = parseInt(timer.getAttribute('data-join-time'));
    if (joinTime) {
      const timeOnline = now - joinTime;
      timer.innerHTML = `<i class="ri-time-line"></i> ${formatTime(timeOnline)}`;
    }
  });
}, 1000);

// ===== UI LOGIC =====
findBtn.onclick = () => { 
  userSidebar.classList.add("active");
  document.body.classList.add("lock-scroll");
  
  if (!localStorage.getItem("omegle_sidebar_hint_seen")) {
      sidebarHint.style.display = "block";
      localStorage.setItem("omegle_sidebar_hint_seen", "true");
  }
};

closeSidebar.onclick = () => { 
  userSidebar.classList.remove("active");
  document.body.classList.remove("lock-scroll");
  sidebarHint.style.display = "none";
};

document.addEventListener('touchstart', () => {
  scrollHint.style.display = 'none';
}, { once: true });

// ===== JOIN =====
joinBtn.onclick = () => {
  if (!nameInput.value.trim()) return;
  const rawName = nameInput.value.trim();
  socket.emit("join", rawName);
};

socket.on("join-success", (data) => {
  myName = data.name;
  localNameLabel.textContent = myName + " (You)";
  nameBox.style.display = "none";
  app.style.display = "block";
  findBtn.disabled = false;
  window.scrollTo(0, 0);
});

// ===== RENDER USER LIST =====
socket.on("update-user-list", (users) => {
  userListContainer.innerHTML = "";
  
  users.forEach(user => {
    if (user.id === socket.id) return; 
    if (!user.name) return; 

    const item = document.createElement("div");
    item.className = `user-item ${user.isCreator ? 'is-creator' : ''}`;
    
    const isClickable = user.status === 'searching';
    const statusText = user.status === 'searching' ? 'Finding...' : 'Busy';
    const statusClass = user.status === 'searching' ? 'status-finding' : 'status-busy';
    const timeOnline = formatTime(Date.now() - user.joinTime);

    const nameDisplay = user.isCreator 
      ? `<span class="creator-name">${user.name}</span> <span class="creator-tag">Creator</span>` 
      : `<span>${user.name}</span>`;

    item.innerHTML = `
      <div class="user-info">
        <div class="u-top"><i class="ri-user-line"></i>${nameDisplay}</div>
        <div class="u-timer" data-join-time="${user.joinTime}">
          <i class="ri-time-line"></i> ${timeOnline}
        </div>
      </div>
      <div class="status-badge ${statusClass}">${statusText}</div>
    `;

    if (isClickable) {
      item.onclick = () => {
        sidebarHint.style.display = "none";
        outgoingRequestTargetId = user.id;
        outgoingTargetName.textContent = user.name;
        outgoingModal.style.display = "flex";
        userSidebar.classList.remove("active"); 
        document.body.classList.remove("lock-scroll");
        socket.emit("direct-connect", user.id);
      };
    } else {
      item.style.opacity = "0.6";
      item.style.cursor = "not-allowed";
    }
    userListContainer.appendChild(item);
  });
  
  if (userListContainer.innerHTML === "") {
    userListContainer.innerHTML = "<p style='text-align:center; color:#94a3b8; margin-top:20px;'>No other users online.</p>";
  }
});

// ===== HANDLE REQUESTS =====
cancelRequestBtn.onclick = () => {
  outgoingModal.style.display = "none";
  if (outgoingRequestTargetId) {
    socket.emit("cancel-request", outgoingRequestTargetId);
    outgoingRequestTargetId = null;
  }
};

socket.on("incoming-request", (data) => {
  incomingRequestId = data.fromId;
  requesterName.textContent = data.fromName;
  requestModal.style.display = "flex"; 
});

socket.on("request-cancelled", (data) => {
  requestModal.style.display = "none";
  alert(`Request cancelled by ${data.fromName}.`);
  incomingRequestId = null;
});

acceptBtn.onclick = async () => {
  requestModal.style.display = "none";
  const stream = await getMedia();
  if (stream) {
    socket.emit("respond-request", { accepted: true, fromId: incomingRequestId });
  }
};

declineBtn.onclick = () => {
  requestModal.style.display = "none";
  socket.emit("respond-request", { accepted: false, fromId: incomingRequestId });
};

socket.on("request-declined", () => {
  outgoingModal.style.display = "none";
  alert("User declined your request.");
  status.textContent = "Click Start or Find";
});

// ===== START =====
startBtn.onclick = async () => {
  startBtn.disabled = true;
  findBtn.disabled = true; 
  nextBtn.disabled = false;
  stopBtn.disabled = false;
  status.textContent = "Looking for someone...";
  statusDot.className = "dot"; 
  await getMedia();
  socket.emit("find-partner");
};

// ===== PEER =====
function createPeer() {
  if (peer) return;
  peer = new RTCPeerConnection(ice);
  if (localStream) localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
  peer.ontrack = e => { 
    remoteVideo.srcObject = e.streams[0]; 
    waitMsg.style.display = "none"; 
  };
  peer.onicecandidate = e => { if (e.candidate) socket.emit("signal", { candidate: e.candidate }); };
}

// ===== MATCH FOUND (NEW: CREATOR LOGIC) =====
socket.on("partner-found", async ({ role, partnerName, isPartnerCreator }) => {
  myRole = role;
  
  // 1. UPDATE NAME
  if (isPartnerCreator) {
    remoteNameLabel.innerHTML = `${partnerName} <span class="creator-badge-video">CREATOR</span>`;
    remoteNameLabel.classList.add('is-creator');
    remoteVideoWrapper.classList.add('creator-border');
  } else {
    remoteNameLabel.textContent = partnerName;
    remoteNameLabel.classList.remove('is-creator');
    remoteVideoWrapper.classList.remove('creator-border');
  }
  
  status.textContent = `Talking to: ${partnerName}`;
  statusDot.className = "dot active"; 
  messageInput.disabled = false;
  
  userSidebar.classList.remove("active");
  document.body.classList.remove("lock-scroll");
  requestModal.style.display = "none"; 
  outgoingModal.style.display = "none"; 

  await getMedia();
  createPeer();

  if (myRole === "caller") {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("signal", { offer });
  }
  
  startBtn.disabled = true;
  findBtn.disabled = true;
  nextBtn.disabled = false;
  stopBtn.disabled = false;
});

// ===== SIGNALING & CHAT =====
socket.on("signal", async data => {
  if (!peer) { await getMedia(); createPeer(); }
  if (data.offer) {
    await peer.setRemoteDescription(data.offer);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("signal", { answer });
  }
  if (data.answer) await peer.setRemoteDescription(data.answer);
  if (data.candidate) await peer.addIceCandidate(data.candidate);
});

const scrollToBottom = () => { messages.scrollTop = messages.scrollHeight; };
const appendMessage = (html) => { messages.insertAdjacentHTML('beforeend', html); scrollToBottom(); };

const sendMessage = () => {
    const text = messageInput.value.trim();
    if (text) {
        appendMessage(`<div class="msg-box my-msg"><b>You:</b> ${text}</div>`);
        socket.emit("chat-message", text);
        messageInput.value = "";
    }
};

messageInput.onkeydown = e => { if (e.key === "Enter") sendMessage(); };
sendBtn.onclick = sendMessage; 

socket.on("chat-message", data => {
  appendMessage(`<div class="msg-box stranger-msg"><b>${data.from}:</b> ${data.text}</div>`);
});

// ===== RESET =====
nextBtn.onclick = () => {
  socket.emit("next");
  resetCall();
  status.textContent = "Looking for someone...";
  socket.emit("find-partner");
};

stopBtn.onclick = () => {
  socket.emit("stop");
  fullReset();
};

socket.on("partner-left", () => {
  status.textContent = "Stranger disconnected. Searching...";
  statusDot.className = "dot";
  resetCall();
  socket.emit("find-partner");
});

socket.on("online-count", count => {
  onlineCount.textContent = `Online: ${count}`;
});

socket.on("error-msg", (msg) => { 
  outgoingModal.style.display = "none";
  alert(msg); 
});

function resetCall() {
  if (peer) { peer.close(); peer = null; }
  remoteVideo.srcObject = null;
  waitMsg.style.display = "flex"; 
  
  // RESET UI
  remoteNameLabel.textContent = "Stranger";
  remoteNameLabel.classList.remove('is-creator');
  remoteVideoWrapper.classList.remove('creator-border');
  
  messages.innerHTML = `<div class="system-msg">Chat cleared. Searching...</div>`;
  messageInput.disabled = true;
}

function fullReset() {
  resetCall();
  status.textContent = "Click Start or Find";
  startBtn.disabled = false;
  findBtn.disabled = false; 
  nextBtn.disabled = true;
  stopBtn.disabled = true;
  messages.innerHTML = `<div class="system-msg">Welcome! Press Start to find a partner.</div>`;
}