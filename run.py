# ============================================================
# run.py - Unified Launcher for SIGNLYF ASL Platform
# ============================================================

import os
import sys
import time
import webbrowser
import threading
import uvicorn

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

def open_browser(url, delay=2.5):
    """Wait for server to start, then open the browser."""
    time.sleep(delay)
    print(f"\n🌐 Opening SIGNLYF in browser: {url}\n")
    webbrowser.open(url)

def main():
    print("=" * 65)
    print("🤟 SIGNLYF — AI Sign Language Communication Platform")
    print("=" * 65)
    print("Starting backend services & web application...")
    print("Models:")
    print("  • ASL Alphabet Vision Classifier (24 classes)")
    print("  • seq2seq English → ASL Gloss Translation")
    print("  • Human Avatar Landmark Animation Engine")
    print("=" * 65)

    host = "127.0.0.1"
    port = 8000
    url = f"http://{host}:{port}"

    # Launch browser in separate thread
    threading.Thread(target=open_browser, args=(url,), daemon=True).start()

    # Start FastAPI / Uvicorn server
    uvicorn.run("backend.app:app", host=host, port=port, log_level="info")

if __name__ == "__main__":
    main()
