/**
 * speech-to-asl.js
 * Speech/Text to ASL Translation & 2D Avatar Animation
 */

const textInput = document.getElementById("speech-text");
const microphoneButton = document.getElementById("microphone-button");
const micStatus = document.getElementById("mic-status");
const translateButton = document.getElementById("translate-button");
const clearButton = document.getElementById("clear-button");
const translationStatus = document.getElementById("translation-status");
const animationStatus = document.getElementById("animation-status");
const engineStatus = document.getElementById("engine-status");
const playButton = document.getElementById("play-button");
const pauseButton = document.getElementById("pause-button");
const replayButton = document.getElementById("replay-button");
const aslCaption = document.getElementById("asl-caption");
const aslPlayerBox = document.getElementById("asl-player");

let avatarRenderer = null;

// Initialize Avatar Canvas inside aslPlayerBox
function initAvatar() {
    if (!aslPlayerBox) return;

    // Check if canvas already exists
    let canvas = document.getElementById("avatar-canvas");
    if (!canvas) {
        aslPlayerBox.innerHTML = `
            <div class="asl-player-label">▶ ASL Avatar Player</div>
            <canvas id="avatar-canvas" style="width:100%; height:100%; min-height:280px; display:block; border-radius:12px;"></canvas>
            <div class="asl-play-caption" id="asl-caption" style="display:none; position:absolute; bottom:12px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.7); padding:6px 14px; border-radius:20px; font-weight:600; color:#fff;"></div>
        `;
    }

    if (window.ASLAvatarRenderer) {
        avatarRenderer = new ASLAvatarRenderer("avatar-canvas", {
            onTokenChange: (token) => {
                const cap = document.getElementById("asl-caption");
                if (cap) {
                    cap.style.display = "block";
                    cap.innerHTML = `🤟 Sign: <span style="color:#818cf8;">${token}</span>`;
                }
            },
            onComplete: () => {
                if (animationStatus) animationStatus.textContent = "COMPLETED";
            }
        });
    }

    // Check backend health
    fetch("/api/health")
        .then(r => r.json())
        .then(d => {
            if (engineStatus) {
                engineStatus.textContent = d.models.gloss_seq2seq ? "Ready (Seq2Seq + Avatar)" : "Model error";
                engineStatus.style.color = "#4ade80";
            }
        })
        .catch(() => {
            if (engineStatus) engineStatus.textContent = "Connecting...";
        });
}

document.addEventListener("DOMContentLoaded", initAvatar);
if (document.readyState === "complete" || document.readyState === "interactive") {
    initAvatar();
}

/* =========================
   SPEECH RECOGNITION (Web Speech API)
========================= */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
        isListening = true;
        microphoneButton?.classList.add("recording");
        if (micStatus) micStatus.textContent = "Listening... Speak now";
    };

    recognition.onresult = (event) => {
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalText += transcript;
            }
        }
        if (finalText && textInput) {
            textInput.value = finalText.trim();
            const countEl = document.getElementById("char-count");
            if (countEl) countEl.textContent = textInput.value.length;
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (micStatus) micStatus.textContent = "Error: " + event.error;
    };

    recognition.onend = () => {
        isListening = false;
        microphoneButton?.classList.remove("recording");
        if (micStatus) micStatus.textContent = "Microphone is off";
    };
}

microphoneButton?.addEventListener("click", () => {
    if (!recognition) {
        alert("Speech recognition is not supported in this browser. Try Chrome or Edge!");
        return;
    }
    if (isListening) {
        recognition.stop();
    } else {
        recognition.start();
    }
});

/* =========================
   TRANSLATE TO ASL
========================= */
async function translateToASL() {
    const text = textInput ? textInput.value.trim() : "";
    if (!text) {
        alert("Please enter or speak text to translate.");
        return;
    }

    if (translationStatus) translationStatus.textContent = "Translating...";
    if (animationStatus) {
        animationStatus.textContent = "GENERATING";
        animationStatus.className = "status-badge online";
    }

    try {
        const response = await fetch("/api/translate/text-to-gloss", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) throw new Error("Translation failed");
        const data = await response.json();

        const gloss = data.gloss || text.toUpperCase();
        const cap = document.getElementById("asl-caption");
        if (cap) {
            cap.style.display = "block";
            cap.innerHTML = `🤟 ASL Gloss: <span style="color:#818cf8;">${gloss}</span>`;
        }

        if (translationStatus) translationStatus.textContent = "Ready";
        if (animationStatus) {
            animationStatus.textContent = "ANIMATING";
            animationStatus.className = "status-badge online";
        }

        // Animate Avatar
        if (avatarRenderer && data.animation) {
            avatarRenderer.loadSequence(data.animation);
        }

        // Save translation to history
        saveTranslation("Text → ASL", `${text} → ${gloss}`);
    } catch (e) {
        console.error("Translation error:", e);
        if (translationStatus) translationStatus.textContent = "Error";
        if (animationStatus) animationStatus.textContent = "ERROR";
        alert("Failed to translate to ASL. Please verify backend is running.");
    }
}

if (translateButton) translateButton.addEventListener("click", translateToASL);

/* =========================
   CLEAR
========================= */
clearButton?.addEventListener("click", () => {
    if (textInput) textInput.value = "";
    const countEl = document.getElementById("char-count");
    if (countEl) countEl.textContent = "0";

    if (translationStatus) translationStatus.textContent = "Waiting";
    if (animationStatus) animationStatus.textContent = "READY";
    const cap = document.getElementById("asl-caption");
    if (cap) cap.style.display = "none";
});

/* =========================
   PLAYER CONTROLS
========================= */
playButton?.addEventListener("click", () => {
    if (avatarRenderer) {
        avatarRenderer.play();
        if (animationStatus) {
            animationStatus.textContent = "PLAYING";
            animationStatus.className = "status-badge online";
        }
    }
});

pauseButton?.addEventListener("click", () => {
    if (avatarRenderer) {
        avatarRenderer.pause();
        if (animationStatus) {
            animationStatus.textContent = "PAUSED";
            animationStatus.className = "status-badge offline";
        }
    }
});

replayButton?.addEventListener("click", () => {
    if (avatarRenderer) {
        avatarRenderer.replay();
        if (animationStatus) {
            animationStatus.textContent = "REPLAYING";
            animationStatus.className = "status-badge online";
        }
    }
});

function saveTranslation(mode, text) {
    try {
        const history = JSON.parse(localStorage.getItem("signlyf_history") || "[]");
        const entry = {
            id: Date.now(),
            mode: mode,
            text: text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: "Today"
        };
        history.unshift(entry);
        if (history.length > 20) history.pop();
        localStorage.setItem("signlyf_history", JSON.stringify(history));
    } catch (e) {}
}

function updateCharCount(el) {
    const countEl = document.getElementById("char-count");
    if (countEl) countEl.textContent = el.value.length;
}
window.updateCharCount = updateCharCount;
