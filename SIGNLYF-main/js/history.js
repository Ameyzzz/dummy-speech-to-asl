/* =========================
   HISTORY PAGE LOGIC
========================= */

function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 2200);
}

function copyText(text, btn) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(`Copied "${text}" to clipboard!`);
            const prev = btn.textContent;
            btn.textContent = "✅";
            setTimeout(() => { btn.textContent = prev; }, 1500);
        });
    }
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
        showToast(`Speaking: "${text}"`);
    } else {
        showToast("Speech synthesis not supported in this browser.");
    }
}

function deleteItem(btn) {
    const item = btn.closest(".history-full-item");
    if (item) {
        item.style.transition = "all 0.3s ease";
        item.style.opacity = "0";
        item.style.transform = "translateX(30px)";
        setTimeout(() => {
            const group = item.closest(".history-date-group");
            item.remove();
            if (group && group.querySelectorAll(".history-full-item").length === 0) {
                group.remove();
            }
            checkEmptyState();
            showToast("Item deleted.");
        }, 300);
    }
}

function checkEmptyState() {
    const list = document.getElementById("history-full-list");
    const emptyState = document.getElementById("empty-state");
    const items = list?.querySelectorAll(".history-full-item");
    if (!items || items.length === 0) {
        if (emptyState) emptyState.style.display = "block";
        if (list) list.style.display = "none";
    }
}

// Clear all items
document.getElementById("clear-all-btn")?.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear your entire translation history?")) {
        const list = document.getElementById("history-full-list");
        if (list) list.innerHTML = "";
        checkEmptyState();
        showToast("History cleared.");
    }
});

// Filtering
document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const filter = btn.dataset.filter;
        const items = document.querySelectorAll(".history-full-item");

        items.forEach(item => {
            if (filter === "all" || item.dataset.type === filter) {
                item.style.display = "flex";
            } else {
                item.style.display = "none";
            }
        });

        // Hide date group if all children are hidden
        document.querySelectorAll(".history-date-group").forEach(group => {
            const visibleItems = Array.from(group.querySelectorAll(".history-full-item")).filter(i => i.style.display !== "none");
            group.style.display = visibleItems.length ? "flex" : "none";
        });
    });
});

// Search input
document.getElementById("search-input")?.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    const items = document.querySelectorAll(".history-full-item");

    items.forEach(item => {
        const text = item.querySelector(".hfi-text")?.textContent.toLowerCase() || "";
        const mode = item.querySelector(".hfi-mode")?.textContent.toLowerCase() || "";
        if (text.includes(query) || mode.includes(query)) {
            item.style.display = "flex";
        } else {
            item.style.display = "none";
        }
    });

    document.querySelectorAll(".history-date-group").forEach(group => {
        const visibleItems = Array.from(group.querySelectorAll(".history-full-item")).filter(i => i.style.display !== "none");
        group.style.display = visibleItems.length ? "flex" : "none";
    });
});

// Load dynamically saved translations from localStorage
(function loadDynamicHistory() {
    try {
        const historyData = JSON.parse(localStorage.getItem("signlyf_history") || "[]");
        if (!historyData.length) return;

        const list = document.getElementById("history-full-list");
        if (!list) return;

        let todayGroup = list.querySelector(".history-date-group");
        if (!todayGroup) {
            todayGroup = document.createElement("div");
            todayGroup.className = "history-date-group";
            todayGroup.innerHTML = `<div class="history-date-label">Recent Sessions</div>`;
            list.prepend(todayGroup);
        }

        historyData.forEach(entry => {
            const isAsl = entry.mode.includes("ASL →");
            const item = document.createElement("div");
            item.className = "history-full-item";
            item.dataset.type = isAsl ? "asl-to-text" : "text-to-asl";
            item.innerHTML = `
                <div class="hfi-icon ${isAsl ? 'qi-blue' : ''}" style="${!isAsl ? 'background:var(--teal-light)' : ''}">${isAsl ? '🤟' : '🔤'}</div>
                <div class="hfi-body">
                    <div class="hfi-meta">
                        <span class="hfi-mode">${entry.mode}</span>
                        <span class="hfi-time">${entry.timestamp || 'Just now'}</span>
                    </div>
                    <div class="hfi-text">${entry.text}</div>
                    <div class="hfi-sub">${isAsl ? 'Live ASL recognition' : 'seq2seq ASL Gloss translation'}</div>
                </div>
                <div class="hfi-actions">
                    <button class="hfi-btn" title="Copy" onclick="copyText('${entry.text.replace(/'/g, "\\'")}', this)">📋</button>
                    <button class="hfi-btn" title="Speak" onclick="speakText('${entry.text.replace(/'/g, "\\'")}')">🔊</button>
                    <button class="hfi-btn danger" title="Delete" onclick="deleteItem(this)">🗑️</button>
                </div>
            `;
            todayGroup.insertBefore(item, todayGroup.children[1] || null);
        });
    } catch (e) {
        console.warn("Could not load stored history:", e);
    }
})();
