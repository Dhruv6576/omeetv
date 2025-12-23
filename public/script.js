
const socket = io();

// ===== ELEMENTS =====
const nameBox = document.getElementById("nameBox");
const joinBtn = document.getElementById("joinBtn");
const nameInput = document.getElementById("nameInput");
const app = document.getElementById("app");
const scrollHint = document.getElementById("scrollHint");
const startBtn = document.getElementById("startBtn");
const nextBtn = document.getElementById("nextBtn");
const stopBtn = document.getElementById("stopBtn");
const findBtn = document.getElementById("findBtn");
const status = document.getElementById("status");
const statusDot = document.getElementById("statusDot");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const remoteVideoWrapper = remoteVideo.parentElement;
const waitMsg = document.getElementById("waitMsg");
const localNameLabel = document.getElementById("localName");
const remoteNameLabel = document.getElementById("remoteName");
const messages = document.getElementById("messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const onlineCount = document.getElementById("onlineCount");
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


// ===== HELPER: SOUND EFFECTS =====
function playSound(id) {
  const audio = document.getElementById(id);
  if (audio) {
    audio.currentTime = 0; // Reset to start if already playing
    audio.play().catch(err => console.log("Audio blocked:", err));
  }
}

// ===== HELPER: GET MEDIA (FORCED FASTER HD) =====
async function getMedia() {
  if (localStream) return localStream;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: {
        // "min" forces it to start at least 640x480 (skips the blurry start)
        width: { min: 640, ideal: 1280 },
        height: { min: 480, ideal: 720 },
        frameRate: { ideal: 30 }
      }, 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    localStream = stream;
    localVideo.srcObject = stream;
    
    // Start monitoring the quality
    startQualityMonitor();
    
    return stream;
  } catch (err) {
    console.error("Camera Error:", err);
    // Fallback: If the camera fails (some old phones can't do 640 min), try basic settings
    try {
       const simpleStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
       localStream = simpleStream;
       localVideo.srcObject = simpleStream;
       startQualityMonitor();
       return simpleStream;
    } catch (retryErr) {
       showMobileNotification("Camera Error", "Could not start camera.", "ri-camera-off-fill", "var(--red)");
       return null;
    }
  }
}

// ===== MOBILE NOTIFICATION SYSTEM =====
function showMobileNotification(title, message, icon = "ri-notification-3-line", color = "var(--accent)") {
  // Remove existing notification
  const existing = document.querySelector('.mobile-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.className = 'mobile-notification';
  notification.innerHTML = `
    <i class="${icon}" style="color: ${color}; font-size: 1.5rem;"></i>
    <div class="mobile-notification-content">
      <strong>${title}</strong>
      <div style="font-size: 0.9rem; margin-top: 3px;">${message}</div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notification.classList.add('hiding');
    setTimeout(() => notification.remove(), 500);
  }, 5000);
}

// ===== HELPER: FORMAT TIME =====
function formatTime(ms) {
  if (isNaN(ms) || ms < 0) return "0:00";
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ===== SCROLL HINT FIXED =====
function initializeScrollHint() {
  // Only show on mobile
  if (window.innerWidth > 768) {
    scrollHint.style.display = 'none';
    return;
  }
  
  // Check if user has already seen the hint
  if (localStorage.getItem("omegle_scroll_hint_seen")) {
    scrollHint.style.display = 'none';
    return;
  }
  
  // Show hint after 1 second
  setTimeout(() => {
    scrollHint.classList.add('show');
  }, 1000);
  
  // Hide on any interaction
  const hideHint = () => {
    scrollHint.classList.add('hiding');
    localStorage.setItem("omegle_scroll_hint_seen", "true");
    
    setTimeout(() => {
      scrollHint.style.display = 'none';
      scrollHint.classList.remove('show', 'hiding');
    }, 500);
  };
  
  // Add event listeners
  document.addEventListener('touchstart', hideHint, { once: true });
  document.addEventListener('click', hideHint, { once: true });
  
  // Auto-hide after 8 seconds
  setTimeout(hideHint, 8000);
}

// ===== RIPPLE EFFECT =====
function createRipple(event) {
  const btn = event.currentTarget;
  const circle = document.createElement("span");
  const diameter = Math.max(btn.clientWidth, btn.clientHeight);
  const radius = diameter / 2;
  
  circle.style.width = circle.style.height = `${diameter}px`;
  circle.style.left = `${event.clientX - btn.getBoundingClientRect().left - radius}px`;
  circle.style.top = `${event.clientY - btn.getBoundingClientRect().top - radius}px`;
  circle.classList.add("ripple");
  
  const ripple = btn.getElementsByClassName("ripple")[0];
  if (ripple) ripple.remove();
  
  btn.appendChild(circle);
}

// Add ripple effect to buttons
document.querySelectorAll('.btn, .modal-btn, .primary-btn, .send-btn').forEach(btn => {
  btn.addEventListener('click', createRipple);
});

// ===== UI LOGIC =====
findBtn.onclick = () => {
  userSidebar.classList.add("active");
  document.body.classList.add("lock-scroll");
};

closeSidebar.onclick = () => {
  userSidebar.classList.remove("active");
  document.body.classList.remove("lock-scroll");
};

// ===== JOIN =====
joinBtn.onclick = () => {
  if (!nameInput.value.trim()) {
    showMobileNotification("Name Required", "Please enter a nickname to continue.", "ri-user-smile-line", "var(--yellow)");
    return;
  }
  const rawName = nameInput.value.trim();
  socket.emit("join", rawName);
};

socket.on("join-success", (data) => {
  myName = data.name;
  localNameLabel.textContent = myName + " (You)";
  nameBox.style.display = "none";
  app.style.display = "block";
  findBtn.disabled = false;
  
  // Initialize scroll hint after join
  initializeScrollHint();
  
  // Show welcome notification
  if (data.isCreator) {
    showMobileNotification("Creator Mode Activated", "You have special creator privileges!", "ri-star-fill", "var(--red)");
  }
});

// ===== FIXED: RENDER USER LIST - REMOVED SKIP FOR CURRENT USER =====
socket.on("update-user-list", (users) => {
  userListContainer.innerHTML = "";
  
  users.forEach((user, index) => {
    // REMOVED: Don't skip current user - show everyone including yourself
    // if (user.id === socket.id) return;
    
    if (!user.name) return;
    
    const item = document.createElement("div");
    item.className = `user-item ${user.isCreator ? 'is-creator' : ''}`;
    item.style.setProperty('--item-index', index);
    
    // Check if user is current user
    const isCurrentUser = user.id === socket.id;
    const isClickable = user.status === 'searching' && !isCurrentUser;
    const statusText = isCurrentUser ? 'You' : (user.status === 'searching' ? 'Available' : 'Busy');
    const statusClass = isCurrentUser ? 'status-you' : (user.status === 'searching' ? 'status-finding' : 'status-busy');
    const timeOnline = formatTime(Date.now() - user.joinTime);
    
    // FIXED: Proper creator display with inline elements
    let nameDisplay;
    if (user.isCreator) {
      nameDisplay = `
        <span class="creator-name">
          ${user.name}
          <span class="creator-tag">CREATOR</span>
        </span>
      `;
    } else {
      nameDisplay = `<span>${user.name}</span>`;
    }
    
    // Add "You" indicator for current user
    const nameSuffix = isCurrentUser ? ' <span class="you-indicator">(You)</span>' : '';
    
    item.innerHTML = `
      <div class="user-info">
        <div class="u-top">
          <i class="ri-user-line" style="color:${isCurrentUser ? 'var(--accent)' : (user.status === 'searching' ? 'var(--green)' : 'var(--muted)')}"></i>
          ${nameDisplay}${nameSuffix}
        </div>
        <div class="u-timer" data-join-time="${user.joinTime}">
          <i class="ri-time-line"></i> ${timeOnline}
        </div>
      </div>
      <div class="status-badge ${statusClass}">${statusText}</div>
    `;
    
    if (isClickable) {
      item.onclick = () => {
        outgoingRequestTargetId = user.id;
        outgoingTargetName.textContent = user.name;
        outgoingModal.style.display = "flex";
        userSidebar.classList.remove("active");
        document.body.classList.remove("lock-scroll");
        socket.emit("direct-connect", user.id);
      };
    } else {
      item.style.opacity = isCurrentUser ? "1" : "0.6";
      item.style.cursor = isCurrentUser ? "default" : "not-allowed";
      item.onclick = null;
    }
    
    userListContainer.appendChild(item);
  });
  
  if (userListContainer.innerHTML === "") {
    userListContainer.innerHTML = `
      <div style="text-align:center; color:var(--muted); margin-top:40px; padding:20px;">
        <i class="ri-user-search-line" style="font-size:3rem; margin-bottom:15px; display:block; opacity:0.5;"></i>
        <strong>No other users online yet</strong><br>
        <small style="font-size:0.9rem;">Be the first to invite friends!</small>
      </div>
    `;
  }
});

// ===== HANDLE REQUESTS WITH MOBILE NOTIFICATIONS =====
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
  
  // Show mobile notification for incoming request
  if (window.innerWidth <= 768) {
    showMobileNotification("Incoming Request", `${data.fromName} wants to connect with you.`, "ri-user-add-fill", "var(--green)");
  }
  
  // Set page title notification
  if (document.hidden) {
    document.title = `🔔 ${data.fromName} wants to connect!`;
  }
});

socket.on("request-cancelled", (data) => {
  requestModal.style.display = "none";
  incomingRequestId = null;
  
  // Show notification
  showMobileNotification("Request Cancelled", `${data.fromName} cancelled the request.`, "ri-close-circle-fill", "var(--muted)");
});

acceptBtn.onclick = async () => {
  requestModal.style.display = "none";
  const stream = await getMedia();
  if (stream) {
    socket.emit("respond-request", { accepted: true, fromId: incomingRequestId });
    showMobileNotification("Request Accepted", "Connecting to user...", "ri-check-double-line", "var(--green)");
  }
};

declineBtn.onclick = () => {
  requestModal.style.display = "none";
  socket.emit("respond-request", { accepted: false, fromId: incomingRequestId });
  showMobileNotification("Request Declined", "You declined the connection request.", "ri-close-circle-fill", "var(--muted)");
};

socket.on("request-declined", () => {
  outgoingModal.style.display = "none";
  status.textContent = "Click Start or Find";
  document.title = "Omegle X";
  
  showMobileNotification("Request Declined", "The user declined your connection request.", "ri-thumb-down-fill", "var(--red)");
});

socket.on("error-msg", (msg) => { 
  outgoingModal.style.display = "none";
  showMobileNotification("Error", msg, "ri-error-warning-fill", "var(--red)");
});

// ===== START =====
startBtn.onclick = async () => {
  startBtn.disabled = true;
  findBtn.disabled = true;
  nextBtn.disabled = false;
  stopBtn.disabled = false;
  status.textContent = "Looking for someone...";
  statusDot.className = "dot";
  
  const stream = await getMedia();
  if (stream) {
    socket.emit("find-partner");
    showMobileNotification("Searching", "Looking for a partner to connect with...", "ri-search-eye-line", "var(--accent)");
  }
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

// ===== MATCH FOUND =====
socket.on("partner-found", async ({ role, partnerName, isPartnerCreator }) => {
  playSound("sfx-found");
  
  myRole = role;
  
  // Update name and style
  if (isPartnerCreator) {
    remoteNameLabel.innerHTML = `${partnerName} <span class="creator-badge-video">CREATOR</span>`;
    remoteNameLabel.classList.add('is-creator');
    remoteVideoWrapper.classList.add('creator-border');
  } else {
    remoteNameLabel.textContent = partnerName; // <--- This was deleting the badge
    remoteNameLabel.classList.remove('is-creator');
    remoteVideoWrapper.classList.remove('creator-border');
  }
  
  // FIX: Re-add the quality badge because the lines above wiped it out
  startQualityMonitor(); 

  status.textContent = `Talking to: ${partnerName}`;
  statusDot.className = "dot active";
  messageInput.disabled = false;
  
  userSidebar.classList.remove("active");
  document.body.classList.remove("lock-scroll");
  requestModal.style.display = "none";
  outgoingModal.style.display = "none";
  
  // Show connection notification
  const creatorMsg = isPartnerCreator ? " (CREATOR)" : "";
  showMobileNotification("Connected", `You're now talking with ${partnerName}${creatorMsg}`, "ri-user-voice-fill", isPartnerCreator ? "var(--red)" : "var(--green)");
  
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
const appendMessage = (html) => { 
  messages.insertAdjacentHTML('beforeend', html); 
  scrollToBottom(); 
};

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
  playSound("sfx-msg");
  appendMessage(`<div class="msg-box stranger-msg"><b>${data.from}:</b> ${data.text}</div>`);
});

// ===== RESET =====
nextBtn.onclick = () => {
  socket.emit("next");
  resetCall();
  status.textContent = "Looking for someone...";
  socket.emit("find-partner");
  showMobileNotification("Next User", "Searching for a new partner...", "ri-skip-forward-fill", "var(--accent)");
};

stopBtn.onclick = () => {
  socket.emit("stop");
  fullReset();
  showMobileNotification("Stopped", "Connection ended. Ready for new chat.", "ri-stop-fill", "var(--muted)");
};

socket.on("partner-left", () => {
  playSound("sfx-left");
  status.textContent = "Stranger disconnected. Searching...";
  resetCall();
  socket.emit("find-partner");
  showMobileNotification("Disconnected", "Partner disconnected. Searching for new partner...", "ri-user-unfollow-fill", "var(--red)");
});

socket.on("online-count", count => {
  onlineCount.textContent = `Online: ${count}`;
});

function resetCall() {
  if (peer) { peer.close(); peer = null; }
  remoteVideo.srcObject = null;
  waitMsg.style.display = "flex";
  
  // Reset UI
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

// ===== INITIALIZE & MOBILE COMPATIBILITY =====
window.addEventListener('load', () => {
  // Handle window resize for scroll hint
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      scrollHint.style.display = 'none';
    }
  });
  
  // Prevent zoom on double-tap
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
  
// Fix: Only prevent default if pinch-zooming (more than 1 finger)
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });
});

// Page visibility change for notifications
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    document.title = "Omegle X";
  }
});




// ===== REAL-TIME VIDEO QUALITY MONITOR (IN NAME LABEL) =====
let qualityInterval = null;

function startQualityMonitor() {
  // Clear any running interval
  if (qualityInterval) clearInterval(qualityInterval);

  // Target the name label container
  const nameLabel = document.getElementById("remoteName");

  // Create the quality tag inside the name label if it doesn't exist
  let qTag = document.getElementById("qualityTag");
  if (!qTag && nameLabel) {
    qTag = document.createElement("span");
    qTag.id = "qualityTag";
    
    // Style it as a small pill badge
    Object.assign(qTag.style, {
      fontSize: "0.65rem",
      padding: "2px 6px",
      borderRadius: "4px",
      fontWeight: "700",
      color: "white",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
      display: "none" // Hide initially until video flows
    });
    
    nameLabel.appendChild(qTag);
  }

  // Update every 1 second
  qualityInterval = setInterval(() => {
    const video = document.getElementById("remoteVideo");
    const tag = document.getElementById("qualityTag");
    
    if (video && video.srcObject && !video.paused && video.videoWidth > 0 && tag) {
      const h = video.videoHeight;
      
      let text = "LOW";
      let bg = "rgba(239, 68, 68, 0.8)"; // Red (Low)
      
      if (h >= 720) { 
        text = "HD"; 
        bg = "rgba(34, 197, 94, 0.8)"; // Green (HD)
      } else if (h >= 480) { 
        text = "SD"; 
        bg = "rgba(234, 179, 8, 0.8)"; // Yellow (SD)
      }
      
      tag.textContent = text;
      tag.style.background = bg;
      tag.style.display = "inline-flex"; // Show it
    } else if (tag) {
      tag.style.display = "none"; // Hide if video stops
    }
  }, 1000);
}

// Stop monitoring when call ends and remove the tag
const originalResetCall = resetCall; 
resetCall = function() {
  if (qualityInterval) clearInterval(qualityInterval);
  
  // Hide the tag when call ends
  const tag = document.getElementById("qualityTag");
  if (tag) tag.style.display = "none";
  
  originalResetCall(); 
};
