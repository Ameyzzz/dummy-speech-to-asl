/* ============================================================
   SIGNLYF — Main Application Logic (app.js)
   Integrates Camera ASL Recognition, Speech-to-ASL, Avatar
============================================================ */

let homeCameraStream = null;
let homeRecognitionInterval = null;
let homeOffscreenCanvas = null;
let homeAvatarRenderer = null;
let accumulatedHomeText = "";

/* =========================
   NAVIGATION & CHAR COUNT
========================= */
function openMode(mode) {
    if (mode === "asl-to-speech") window.location.href = "pages/asl-to-speech.html";
    if (mode === "speech-to-asl") window.location.href = "pages/speech-to-asl.html";
}

function updateCharCount(el) {
    const countEl = document.getElementById("char-count");
    if (countEl) countEl.textContent = el.value.length;
}
window.updateCharCount = updateCharCount;

/* =========================
   INITIALIZATION
========================= */
document.addEventListener("DOMContentLoaded", () => {
    initHomeAvatar();
    initHomeCamera();
    initHomeSpeechToASL();
    renderHomeHistory();
    initThemeToggle();
});

/* =========================
   HOME AVATAR PLAYER
========================= */
function initHomeAvatar() {
    const canvas = document.getElementById("home-avatar-canvas");
    if (!canvas || !window.ASLAvatarRenderer) return;

    homeAvatarRenderer = new ASLAvatarRenderer("home-avatar-canvas", {
        onTokenChange: (token) => {
            const cap = document.getElementById("asl-caption");
            if (cap) {
                cap.style.display = "block";
                cap.textContent = `🤟 Sign: ${token}`;
            }
        }
    });
}

/* =========================
   HOME CAMERA ASL DETECTION
========================= */
function initHomeCamera() {
    const startBtn = document.getElementById("start-camera");
    const stopBtn = document.getElementById("stop-camera");
    const clearBtn = document.getElementById("clear-button");
    const speakBtn = document.getElementById("speak-camera-btn");
    const camera = document.getElementById("camera");
    const placeholder = document.getElementById("cam-placeholder");
    const overlay = document.getElementById("cam-overlay");
    const statusBadge = document.getElementById("cam-status-badge");
    const recognizedText = document.getElementById("recognized-text");
    const confBadge = document.getElementById("confidence-badge");

    // Only run on home page
    if (!camera || !startBtn || !statusBadge) return;

    startBtn.addEventListener("click", async () => {
        try {
            homeCameraStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
                audio: false
            });

            camera.srcObject = homeCameraStream;
            camera.style.display = "block";
            if (placeholder) placeholder.style.display = "none";
            if (overlay) overlay.style.display = "block";

            if (statusBadge) {
                statusBadge.textContent = "Detecting signs";
                statusBadge.className = "cam-status online";
            }

            if (!homeOffscreenCanvas) {
                homeOffscreenCanvas = document.createElement("canvas");
                homeOffscreenCanvas.width = 200;
                homeOffscreenCanvas.height = 200;
            }

            let lastLetter = "";
            let holdCount = 0;

            homeRecognitionInterval = setInterval(async () => {
                if (!homeCameraStream || !camera.videoWidth) return;
                try {
                    const ctx = homeOffscreenCanvas.getContext("2d");
                    const size = Math.min(camera.videoWidth, camera.videoHeight);
                    const sx = (camera.videoWidth - size) / 2;
                    const sy = (camera.videoHeight - size) / 2;
                    ctx.drawImage(camera, sx, sy, size, size, 0, 0, 200, 200);

                    const b64 = homeOffscreenCanvas.toDataURL("image/jpeg", 0.8);
                    const res = await fetch("/api/recognize/asl-frame", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ image: b64 })
                    });
                    if (!res.ok) return;
                    const data = await res.json();

                    if (data && data.letter) {
                        if (recognizedText) recognizedText.textContent = data.letter;
                        if (confBadge) {
                            confBadge.style.display = "inline-flex";
                            confBadge.textContent = `${data.confidence}% confidence`;
                            confBadge.style.color = data.confidence >= 70 ? "#4ade80" : "#facc15";
                        }

                        if (data.confidence >= 60) {
                            if (data.letter === lastLetter) {
                                holdCount++;
                                if (holdCount === 3) {
                                    accumulatedHomeText += data.letter;
                                    if (recognizedText) {
                                        recognizedText.textContent = `${data.letter} (${accumulatedHomeText})`;
                                    }
                                    saveHomeHistory("ASL → Text", accumulatedHomeText);
                                }
                            } else {
                                lastLetter = data.letter;
                                holdCount = 1;
                            }
                        }
                    }
                } catch (e) {}
            }, 350);
        } catch (err) {
            console.error("Camera access error:", err);
            alert("Camera access denied. Please grant permission in your browser.");
        }
    });

    stopBtn?.addEventListener("click", () => {
        if (homeRecognitionInterval) clearInterval(homeRecognitionInterval);
        if (homeCameraStream) {
            homeCameraStream.getTracks().forEach(t => t.stop());
            homeCameraStream = null;
        }
        camera.srcObject = null;
        camera.style.display = "none";
        if (placeholder) placeholder.style.display = "flex";
        if (overlay) overlay.style.display = "none";
        if (statusBadge) {
            statusBadge.textContent = "Camera Ready";
            statusBadge.className = "cam-status offline";
        }
    });

    clearBtn?.addEventListener("click", () => {
        accumulatedHomeText = "";
        if (recognizedText) recognizedText.textContent = "—";
        if (confBadge) confBadge.style.display = "none";
    });

    speakBtn?.addEventListener("click", () => {
        const text = accumulatedHomeText || (recognizedText ? recognizedText.textContent.trim() : "");
        if (!text || text === "—") return;
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance(text);
            utt.lang = "en-US";
            window.speechSynthesis.speak(utt);
        }
    });
}

/* =========================
   HOME SPEECH-TO-ASL TRANSLATION
========================= */
function initHomeSpeechToASL() {
    const textInput = document.getElementById("speech-text");
    const micBtn = document.getElementById("microphone-button");
    const micStatus = document.getElementById("mic-status");
    const transBtn = document.getElementById("translate-button");
    const aslCaption = document.getElementById("asl-caption");

    if (!transBtn || !document.getElementById("home-avatar-canvas")) return;

    // Mic setup
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    let rec = null;
    let isListening = false;
    if (SpeechRec) {
        rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = "en-US";

        rec.onstart = () => {
            isListening = true;
            micBtn?.classList.add("recording");
            if (micStatus) micStatus.textContent = "Listening...";
        };
        rec.onresult = (e) => {
            let str = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) str += e.results[i][0].transcript;
            }
            if (str && textInput) {
                textInput.value = str.trim();
                updateCharCount(textInput);
            }
        };
        rec.onend = () => {
            isListening = false;
            micBtn?.classList.remove("recording");
            if (micStatus) micStatus.textContent = "Microphone off";
        };
    }

    micBtn?.addEventListener("click", () => {
        if (!rec) {
            alert("Speech recognition is supported in Chrome & Edge.");
            return;
        }
        if (isListening) rec.stop();
        else rec.start();
    });

    // Translate button
    transBtn.addEventListener("click", async () => {
        const text = textInput ? textInput.value.trim() : "";
        if (!text) {
            alert("Please type or speak something first.");
            return;
        }

        transBtn.textContent = "Translating...";
        try {
            const res = await fetch("/api/translate/text-to-gloss", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: text })
            });
            const data = await res.json();
            transBtn.textContent = "▶ Translate to ASL";

            const gloss = data.gloss || text.toUpperCase();
            if (aslCaption) {
                aslCaption.style.display = "block";
                aslCaption.textContent = `▶ ASL: ${gloss}`;
            }

            if (homeAvatarRenderer && data.animation) {
                homeAvatarRenderer.loadSequence(data.animation);
            }

            saveHomeHistory("Text → ASL", `${text} → ${gloss}`);
            renderHomeHistory();
        } catch (e) {
            transBtn.textContent = "▶ Translate to ASL";
            console.error("Translation request failed:", e);
        }
    });
}

/* =========================
   HOME HISTORY RENDERING
========================= */
function saveHomeHistory(mode, text) {
    try {
        const history = JSON.parse(localStorage.getItem("signlyf_history") || "[]");
        if (history.length && history[0].text === text) return;
        history.unshift({
            id: Date.now(),
            mode: mode,
            text: text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        if (history.length > 15) history.pop();
        localStorage.setItem("signlyf_history", JSON.stringify(history));
    } catch (e) {}
}

function renderHomeHistory() {
    const list = document.getElementById("history-list");
    if (!list) return;

    try {
        const history = JSON.parse(localStorage.getItem("signlyf_history") || "[]");
        if (!history.length) return;

        list.innerHTML = "";
        history.slice(0, 4).forEach(item => {
            const isAsl = item.mode.includes("ASL →");
            const div = document.createElement("div");
            div.className = "history-item";
            div.innerHTML = `
                <div class="history-icon">${isAsl ? '🤟' : '🔤'}</div>
                <div class="history-info">
                    <div class="history-mode">${item.mode}</div>
                    <div class="history-text">${item.text}</div>
                </div>
                <span class="history-time">${item.timestamp}</span>
                <button class="history-copy" title="Copy">📋</button>
            `;
            const copyBtn = div.querySelector(".history-copy");
            copyBtn.addEventListener("click", () => {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(item.text);
                    copyBtn.textContent = "✅";
                    setTimeout(() => copyBtn.textContent = "📋", 1200);
                }
            });
            list.appendChild(div);
        });
    } catch (e) {}
}

/* =========================
   THEME TOGGLE
========================= */
function initThemeToggle() {
    const themeBtn = document.querySelector(".header-icon-btn");
    if (!themeBtn) return;
    themeBtn.addEventListener("click", () => {
        document.body.classList.toggle("light-theme");
        themeBtn.textContent = document.body.classList.contains("light-theme") ? "🌙" : "☀️";
    });
}

/* =========================
   SCROLL REVEAL & UI HELPERS
========================= */
(function () {
    const reveals = document.querySelectorAll(".reveal");
    if (!reveals.length) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08 });
    reveals.forEach((el) => observer.observe(el));
})();
