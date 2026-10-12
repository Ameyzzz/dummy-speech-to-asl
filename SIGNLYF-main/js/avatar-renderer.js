/**
 * avatar-renderer.js
 * Canvas-based Human Avatar Renderer for SIGNLYF
 * Inspired by animation_engine.py
 */

class ASLAvatarRenderer {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.warn(`Canvas with id "${canvasId}" not found.`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.options = Object.assign({
            skinColor: '#F5D0A9',
            torsoColor: '#4F46E5',
            limbColor: '#6366F1',
            accentColor: '#4338CA',
            fps: 24,
            playbackSpeed: 1.0
        }, options);

        this.frames = [];
        this.tokens = [];
        this.currentFrameIndex = 0;
        this.isPlaying = false;
        this.animationTimer = null;
        this.idleTime = 0;
        this.isIdle = true;

        this.onTokenChange = options.onTokenChange || null;
        this.onComplete = options.onComplete || null;

        this._setupCanvas();
        this._startIdleLoop();
    }

    _setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const width = rect.width || 360;
        const height = rect.height || 360;

        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = width;
        this.height = height;
    }

    loadSequence(animationData) {
        if (!animationData || !animationData.frames || !animationData.frames.length) {
            return;
        }
        this.frames = animationData.frames;
        this.tokens = animationData.tokens || [];
        this.fps = animationData.fps || 24;
        this.currentFrameIndex = 0;
        this.isIdle = false;
        this.play();
    }

    play() {
        if (!this.frames.length) return;
        this.isPlaying = true;
        this.isIdle = false;
        if (this.animationTimer) cancelAnimationFrame(this.animationTimer);

        let lastTime = performance.now();
        const interval = 1000 / (this.fps * this.options.playbackSpeed);

        const loop = (currentTime) => {
            if (!this.isPlaying) return;

            const delta = currentTime - lastTime;
            if (delta >= interval) {
                lastTime = currentTime - (delta % interval);
                this._drawCurrentFrame();
                this._checkTokenCue();
                this.currentFrameIndex++;

                if (this.currentFrameIndex >= this.frames.length) {
                    this.currentFrameIndex = 0;
                    this.isPlaying = false;
                    this.isIdle = true;
                    if (this.onComplete) this.onComplete();
                    this._startIdleLoop();
                    return;
                }
            }
            this.animationTimer = requestAnimationFrame(loop);
        };

        this.animationTimer = requestAnimationFrame(loop);
    }

    pause() {
        this.isPlaying = false;
        if (this.animationTimer) cancelAnimationFrame(this.animationTimer);
    }

    replay() {
        this.currentFrameIndex = 0;
        this.play();
    }

    setSpeed(speed) {
        this.options.playbackSpeed = parseFloat(speed) || 1.0;
    }

    _checkTokenCue() {
        if (!this.tokens || !this.onTokenChange) return;
        const currentToken = this.tokens.find(
            t => this.currentFrameIndex >= t.start_frame && this.currentFrameIndex <= t.end_frame
        );
        if (currentToken) {
            this.onTokenChange(currentToken.token);
        }
    }

    _startIdleLoop() {
        if (this.isPlaying) return;
        const idleLoop = () => {
            if (!this.isIdle) return;
            this.idleTime += 0.05;
            this._drawIdleFrame(this.idleTime);
            requestAnimationFrame(idleLoop);
        };
        requestAnimationFrame(idleLoop);
    }

    _drawIdleFrame(t) {
        const breath = Math.sin(t) * 0.008;
        const neutralPose = this._getStandardPose(breath);
        this._renderPose(neutralPose);
    }

    _drawCurrentFrame() {
        const frame = this.frames[this.currentFrameIndex];
        if (frame) {
            this._renderPose(frame);
        }
    }

    _getStandardPose(offsetY = 0) {
        const pose = [];
        for (let i = 0; i < 33; i++) pose.push({ x: 0.5, y: 0.5, z: 0 });
        pose[0] = { x: 0.50, y: 0.20 + offsetY, z: 0 };    // Nose
        pose[11] = { x: 0.38, y: 0.35 + offsetY, z: 0 };   // Left shoulder
        pose[12] = { x: 0.62, y: 0.35 + offsetY, z: 0 };   // Right shoulder
        pose[13] = { x: 0.34, y: 0.52 + offsetY, z: 0 };   // Left elbow
        pose[14] = { x: 0.66, y: 0.52 + offsetY, z: 0 };   // Right elbow
        pose[15] = { x: 0.36, y: 0.68 + offsetY, z: 0 };   // Left wrist
        pose[16] = { x: 0.64, y: 0.68 + offsetY, z: 0 };   // Right wrist
        pose[23] = { x: 0.42, y: 0.72 + offsetY, z: 0 };   // Left hip
        pose[24] = { x: 0.58, y: 0.72 + offsetY, z: 0 };   // Right hip

        const leftHand = [{ x: 0.36, y: 0.68 + offsetY, z: 0 }];
        const rightHand = [{ x: 0.64, y: 0.68 + offsetY, z: 0 }];

        return { pose, left_hand: leftHand, right_hand: rightHand };
    }

    _renderPose(frame) {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;

        ctx.clearRect(0, 0, w, h);

        // Background subtle gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
        bgGrad.addColorStop(0, '#1E1B4B');
        bgGrad.addColorStop(1, '#0F172A');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        const pose = frame.pose;
        if (!pose || pose.length < 25) return;

        const toScreen = (p) => ({
            x: p.x * w,
            y: p.y * h
        });

        const nose = toScreen(pose[0]);
        const ls = toScreen(pose[11]);
        const rs = toScreen(pose[12]);
        const le = toScreen(pose[13]);
        const re = toScreen(pose[14]);
        const lw = toScreen(pose[15]);
        const rw = toScreen(pose[16]);
        const lh = toScreen(pose[23]);
        const rh = toScreen(pose[24]);

        // 1. Torso
        ctx.fillStyle = this.options.torsoColor;
        ctx.beginPath();
        ctx.moveTo(ls.x, ls.y);
        ctx.lineTo(rs.x, rs.y);
        ctx.lineTo(rh.x, rh.y);
        ctx.lineTo(lh.x, lh.y);
        ctx.closePath();
        ctx.fill();

        // 2. Head & Neck
        const neckY = (ls.y + rs.y) / 2;
        ctx.strokeStyle = this.options.skinColor;
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(w * 0.5, neckY);
        ctx.lineTo(nose.x, nose.y + 15);
        ctx.stroke();

        // Head ellipse
        ctx.fillStyle = this.options.skinColor;
        ctx.beginPath();
        ctx.arc(nose.x, nose.y, w * 0.09, 0, Math.PI * 2);
        ctx.fill();

        // Eyes & friendly expression
        ctx.fillStyle = '#312E81';
        ctx.beginPath();
        ctx.arc(nose.x - 10, nose.y - 4, 3, 0, Math.PI * 2);
        ctx.arc(nose.x + 10, nose.y - 4, 3, 0, Math.PI * 2);
        ctx.fill();

        // Smile
        ctx.strokeStyle = '#312E81';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(nose.x, nose.y + 4, 8, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();

        // 3. Arms & Limbs
        const drawLimb = (p1, p2, width) => {
            ctx.strokeStyle = this.options.limbColor;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // Joint highlight
            ctx.fillStyle = this.options.accentColor;
            ctx.beginPath();
            ctx.arc(p1.x, p1.y, width * 0.5, 0, Math.PI * 2);
            ctx.arc(p2.x, p2.y, width * 0.4, 0, Math.PI * 2);
            ctx.fill();
        };

        // Left Arm
        drawLimb(ls, le, 14);
        drawLimb(le, lw, 11);

        // Right Arm
        drawLimb(rs, re, 14);
        drawLimb(re, rw, 11);

        // 4. Hands
        const drawHand = (wrist) => {
            ctx.fillStyle = this.options.skinColor;
            ctx.beginPath();
            ctx.arc(wrist.x, wrist.y, 11, 0, Math.PI * 2);
            ctx.fill();

            // Fingers indicator
            ctx.strokeStyle = this.options.skinColor;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(wrist.x - 6, wrist.y - 4);
            ctx.lineTo(wrist.x - 6, wrist.y - 12);
            ctx.moveTo(wrist.x - 2, wrist.y - 6);
            ctx.lineTo(wrist.x - 2, wrist.y - 14);
            ctx.moveTo(wrist.x + 2, wrist.y - 6);
            ctx.lineTo(wrist.x + 2, wrist.y - 14);
            ctx.moveTo(wrist.x + 6, wrist.y - 4);
            ctx.lineTo(wrist.x + 6, wrist.y - 11);
            ctx.stroke();
        };

        drawHand(lw);
        drawHand(rw);
    }
}

window.ASLAvatarRenderer = ASLAvatarRenderer;
