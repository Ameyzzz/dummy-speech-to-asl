/**
 * asl-to-speech.js
 * Real-time ASL Alphabet Recognition & Text-to-Speech
 */

const camera = document.getElementById("camera");
const cameraPlaceholder = document.getElementById("camera-placeholder");
const camDetecting = document.getElementById("cam-detecting");
const startButton = document.getElementById("start-camera");
const stopButton = document.getElementById("stop-camera");
const cameraStatus = document.getElementById("camera-status");
const detectionStatus = document.getElementById("detection-status");
const recognizedText = document.getElementById("recognized-text");
const recognizedOutput = document.getElementById("recognized-output");
const confidenceBadge = document.getElementById("confidence-badge");
const modelStatus = document.getElementById("model-status");
const speakButton = document.getElementById("speak-button");
const clearButton = document.getElementById("clear-button");

let cameraStream = null;
let recognitionInterval = null;
let offscreenCanvas = null;
let lastPredictedLetter = null;
let letterHoldCount = 0;
let accumulatedSentence = "";

// Check backend status on load
async function checkBackend() {
    try {
        const res = await fetch("/api/health");
        const data = await res.json();
        if (modelStatus) {
            modelStatus.textContent = data.models.alphabet_vision ? "Ready (CNN 24-Class)" : "Model error";
            modelStatus.style.color = "#4ade80";
        }
    } catch (e) {
        if (modelStatus) {
            modelStatus.textContent = "Connecting...";
        }
    }
}
checkBackend();

/* =========================
   START CAMERA & RECOGNITION
========================= */
async function startCamera() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user"
            },
            audio: false
        });

        camera.srcObject = cameraStream;
        camera.style.display = "block";
        if (cameraPlaceholder) cameraPlaceholder.style.display = "none";
        if (camDetecting) camDetecting.style.display = "block";

        if (cameraStatus) {
            cameraStatus.textContent = "ONLINE";
            cameraStatus.className = "status-badge online";
        }
        if (detectionStatus) {
            detectionStatus.textContent = "Detecting signs...";
            detectionStatus.className = "status-badge online";
        }

        // Initialize offscreen canvas for frame capture
        if (!offscreenCanvas) {
            offscreenCanvas = document.createElement("canvas");
            offscreenCanvas.width = 200;
            offscreenCanvas.height = 200;
        }

        // Start frame capture loop (every 350ms)
        recognitionInterval = setInterval(captureAndPredict, 350);
        console.log("Camera started and ASL vision loop active.");
    } catch (error) {
        console.error("Camera error:", error);
        if (cameraStatus) {
            cameraStatus.textContent = "ERROR";
            cameraStatus.className = "status-badge offline";
        }
        if (detectionStatus) detectionStatus.textContent = "Camera access denied.";
        alert("Please grant camera permissions to enable ASL sign detection.");
    }
}

/* =========================
   CAPTURE & PREDICT FRAME
========================= */
async function captureAndPredict() {
    if (!cameraStream || !camera.videoWidth) return;

    try {
        const ctx = offscreenCanvas.getContext("2d");
        // Center crop or scale to 200x200
        const vw = camera.videoWidth;
        const vh = camera.videoHeight;
        const size = Math.min(vw, vh);
        const sx = (vw - size) / 2;
        const sy = (vh - size) / 2;

        ctx.drawImage(camera, sx, sy, size, size, 0, 0, 200, 200);
        const base64Data = offscreenCanvas.toDataURL("image/jpeg", 0.85);

        const response = await fetch("/api/recognize/asl-frame", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64Data })
        });

        if (!response.ok) return;
        const result = await response.json();

        if (result && result.letter) {
            const letter = result.letter;
            const conf = result.confidence;

            // Update UI with detected letter
            if (recognizedText) {
                recognizedText.textContent = letter;
            }

            if (confidenceBadge) {
                confidenceBadge.style.display = "inline-flex";
                confidenceBadge.textContent = `${conf}% confidence`;
                confidenceBadge.style.color = conf >= 70 ? "#4ade80" : "#facc15";
            }

            // Letter stability debounce: if held for 3 consecutive intervals (~1 sec), append
            if (conf >= 60) {
                if (letter === lastPredictedLetter) {
                    letterHoldCount++;
                    if (letterHoldCount === 3) {
                        appendLetter(letter);
                    }
                } else {
                    lastPredictedLetter = letter;
                    letterHoldCount = 1;
                }
            }
        }
    } catch (e) {
        console.warn("Prediction network error:", e);
    }
}

function appendLetter(letter) {
    accumulatedSentence += letter;
    if (recognizedOutput) {
        recognizedOutput.textContent = accumulatedSentence;
        recognizedOutput.classList.remove("empty");
    }
    // Save to history once word has 2+ letters
    if (accumulatedSentence.length >= 2) {
        saveTranslation("ASL → Text", accumulatedSentence);
    }
}

/* =========================
   STOP CAMERA
========================= */
function stopCamera() {
    if (recognitionInterval) {
        clearInterval(recognitionInterval);
        recognitionInterval = null;
    }

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    camera.srcObject = null;
    camera.style.display = "none";
    if (cameraPlaceholder) cameraPlaceholder.style.display = "flex";
    if (camDetecting) camDetecting.style.display = "none";

    if (cameraStatus) {
        cameraStatus.textContent = "OFFLINE";
        cameraStatus.className = "status-badge offline";
    }
    if (detectionStatus) {
        detectionStatus.textContent = "Waiting";
        detectionStatus.className = "status-badge offline";
    }
}

/* =========================
   TEXT TO SPEECH
========================= */
function speakText() {
    const text = (recognizedOutput ? recognizedOutput.textContent.trim() : "") ||
                 (recognizedText ? recognizedText.textContent.trim() : "");

    if (!text || text === "Waiting for signs..." || text === "—") {
        alert("No text detected yet to speak.");
        return;
    }

    if (!("speechSynthesis" in window)) {
        alert("Text-to-speech is not supported in this browser.");
        return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
}

/* =========================
   CLEAR
========================= */
function clearText() {
    accumulatedSentence = "";
    lastPredictedLetter = null;
    letterHoldCount = 0;

    if (recognizedText) recognizedText.textContent = "—";
    if (recognizedOutput) {
        recognizedOutput.textContent = "Waiting for signs...";
        recognizedOutput.classList.add("empty");
    }
    if (confidenceBadge) confidenceBadge.style.display = "none";
}

/* =========================
   HISTORY STORAGE
========================= */
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
        // Avoid duplicate spam
        if (history.length && history[0].text === text) return;
        history.unshift(entry);
        if (history.length > 20) history.pop();
        localStorage.setItem("signlyf_history", JSON.stringify(history));
    } catch (e) {}
}

/* =========================
   EVENT LISTENERS
========================= */
if (startButton) startButton.addEventListener("click", startCamera);
if (stopButton) stopButton.addEventListener("click", stopCamera);
if (speakButton) speakButton.addEventListener("click", speakText);
if (clearButton) clearButton.addEventListener("click", clearText);