/* js/sound.js - Butzcraft SoundManager
 *
 * Sprint 4 Erweiterungen:
 *  1. Voice-Cap: Maximal MAX_VOICES gleichzeitige Sources, damit Mob-Wellen das Audio nicht zerstören.
 *     Älteste Source wird sanft abgewürgt, wenn der Pool voll ist (LRU-Drop).
 *  2. Pro-Sound-Cooldown: Verhindert, dass derselbe Sound innerhalb von MIN_REPEAT_MS doppelt feuert
 *     (typisch bei Mob-Spawns, die alle in derselben Frame play* aufrufen).
 *  3. 3D-Spatial-Attenuation: Wenn eine Position UND ein registrierter Listener vorhanden sind,
 *     skaliert die Lautstärke linear mit der Distanz, und ein Stereo-Pan zeigt links/rechts an.
 *  4. API rückwärts-kompatibel: playPig() ohne Args verhält sich wie früher (volle Lautstärke, kein Pan).
 *     Neu: playPig({x,y,z}) für Spatial-Sound.
 */

const MAX_VOICES = 16;            // Globaler harter Cap aktiver Sources (ohne Musik/UW)
const MIN_REPEAT_MS = 40;         // Pro Sound-Name min. Pause zwischen zwei Starts
const SPATIAL_MAX_DIST = 30;      // Ab dieser Distanz ist die Lautstärke 0
const SPATIAL_MIN_DIST = 2;       // Innerhalb davon volle Lautstärke
const SPATIAL_PAN_SCALE = 0.7;    // Wie stark der Stereo-Pan ausschlägt (0..1)

export const SoundManager = {
    ctx: null,
    buffers: {},
    // Pool aktiver Sources zur Voice-Cap-Verwaltung. Eintrag: { source, gain, panner, startedAt }
    activeVoices: [],
    lastPlayedAt: {},   // name -> performance.now() der letzten Wiedergabe
    listener: null,     // { pos: {x,y,z}, forward: {x,y,z}, right: {x,y,z} }

    init() {
        try {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.ctx = new AudioCtx();
                    this.loadSound('chicken', 'sounds/chicken.ogg');
                    this.loadSound('pig', 'sounds/pig.ogg');
                    this.loadSound('sheep', 'sounds/sheep.ogg');
                    this.loadSound('zombie', 'sounds/zombie.ogg');
                    this.loadSound('sword', 'sounds/sword.ogg');
                    this.loadSound('cow', 'sounds/cow.ogg');
                    this.loadSound('step_grass', 'sounds/step_grass.ogg');
                    this.loadSound('step_stone', 'sounds/step_stone.ogg');
                    this.loadSound('step_sand', 'sounds/step_sand.ogg');
                    this.loadSound('step_wood', 'sounds/step_wood.ogg');
                    this.loadSound('dig_grass', 'sounds/dig_grass.ogg');
                    this.loadSound('dig_stone', 'sounds/dig_stone.ogg');
                    this.loadSound('dig_sand', 'sounds/dig_sand.ogg');
                    this.loadSound('dig_wood', 'sounds/dig_wood.ogg');
                    this.loadSound('water_splash', 'sounds/water_splash.ogg');
                    this.loadSound('underwater', 'sounds/underwater.ogg');
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(e => console.warn(e));
            }
            this.startMusicLoop();
        } catch (err) {
            console.warn("Sound init failed", err);
        }
    },

    /**
     * Aktualisiert den Listener-Bezug für 3D-Spatial-Sounds.
     * Erwartet wird die Player-Camera (Three.js Camera oder PointerLockControls.getObject()).
     * Wird typischerweise einmal pro Frame in der Render-Loop aufgerufen.
     */
    updateListener(cameraOrObject) {
        if (!cameraOrObject) { this.listener = null; return; }
        const pos = cameraOrObject.position;
        if (!pos) return;
        // Vorwärts- und Rechts-Vektor aus Quaternion ableiten
        const forward = { x: 0, y: 0, z: -1 };
        const right = { x: 1, y: 0, z: 0 };
        if (cameraOrObject.quaternion) {
            const q = cameraOrObject.quaternion;
            // Quaternion * (0,0,-1)
            const fx = -2 * (q.x * q.z + q.w * q.y);
            const fy = -2 * (q.y * q.z - q.w * q.x);
            const fz = -(1 - 2 * (q.x * q.x + q.y * q.y));
            forward.x = fx; forward.y = fy; forward.z = fz;
            // Quaternion * (1,0,0)
            const rx = 1 - 2 * (q.y * q.y + q.z * q.z);
            const ry = 2 * (q.x * q.y + q.w * q.z);
            const rz = 2 * (q.x * q.z - q.w * q.y);
            right.x = rx; right.y = ry; right.z = rz;
        }
        this.listener = { pos: { x: pos.x, y: pos.y, z: pos.z }, forward, right };
    },

    /**
     * Berechnet (volumeScale, pan) für einen Sound an `position`.
     * Wenn Listener fehlt → (1.0, 0). Außerhalb SPATIAL_MAX_DIST → (0, 0) (Sound wird gedroppt).
     */
    _computeSpatial(position) {
        if (!this.listener) return { volScale: 1.0, pan: 0 };
        const lp = this.listener.pos;
        const dx = position.x - lp.x, dy = position.y - lp.y, dz = position.z - lp.z;
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist >= SPATIAL_MAX_DIST) return { volScale: 0, pan: 0 };
        let volScale = 1.0;
        if (dist > SPATIAL_MIN_DIST) {
            // Linear falloff zwischen MIN und MAX
            volScale = 1 - (dist - SPATIAL_MIN_DIST) / (SPATIAL_MAX_DIST - SPATIAL_MIN_DIST);
        }
        // Pan: Dot-Product der Differenz mit Listener-Right ergibt links/rechts.
        const r = this.listener.right;
        const invDist = dist > 0.0001 ? 1 / dist : 0;
        const dot = (dx * r.x + dy * r.y + dz * r.z) * invDist;
        const pan = Math.max(-1, Math.min(1, dot * SPATIAL_PAN_SCALE));
        return { volScale, pan };
    },

    startMusicLoop() {
        if (!this.ctx || this.musicBuffer) return;
        fetch('sounds/music.ogg')
            .then(res => res.arrayBuffer())
            .then(data => this.ctx.decodeAudioData(data))
            .then(buffer => {
                this.musicBuffer = buffer;
                setTimeout(() => this.playMusicSequence(), 5000);
            })
            .catch(err => console.warn("Konnte music.ogg nicht laden:", err));
    },

    playMusicSequence() {
        if (!this.ctx || !this.musicBuffer) return;
        try {
            const source = this.ctx.createBufferSource();
            source.buffer = this.musicBuffer;
            const gain = this.ctx.createGain();
            gain.gain.value = 0.25;
            source.connect(gain);
            gain.connect(this.ctx.destination);
            // Musik UMGEHT bewusst die Voice-Cap — sie soll nicht von Mob-Spam abgewürgt werden.
            source.onended = () => {
                setTimeout(() => this.playMusicSequence(), 60000 + Math.random() * 180000);
            };
            source.start();
        } catch (e) {
            console.warn("Musik-Wiedergabe fehlgeschlagen:", e);
        }
    },

    loadSound(name, url) {
        if (!this.ctx) return;
        fetch(url)
            .then(res => res.arrayBuffer())
            .then(data => {
                this.ctx.decodeAudioData(data,
                    (buffer) => { this.buffers[name] = buffer; },
                    (err) => { console.warn("Decode error:", err); }
                );
            })
            .catch(err => console.warn("Error loading sound:", name, err));
    },

    /**
     * Räumt einen Voice-Pool-Eintrag auf und entfernt ihn aus activeVoices.
     */
    _disposeVoice(voice) {
        try {
            if (voice.source) {
                voice.source.onended = null;
                try { voice.source.stop(); } catch(e) {}
                try { voice.source.disconnect(); } catch(e) {}
            }
            if (voice.gain) try { voice.gain.disconnect(); } catch(e) {}
            if (voice.panner) try { voice.panner.disconnect(); } catch(e) {}
        } catch(e) {}
        const idx = this.activeVoices.indexOf(voice);
        if (idx !== -1) this.activeVoices.splice(idx, 1);
    },

    /**
     * Wirft die älteste aktive Voice raus, wenn der Pool voll ist (LRU).
     */
    _enforceVoiceCap() {
        while (this.activeVoices.length >= MAX_VOICES) {
            this._disposeVoice(this.activeVoices[0]);
        }
    },

    /**
     * Hauptsignatur: playSound(name, vol, pitch, options)
     *   options.position: {x,y,z}    → 3D-Spatial (Attenuation + Pan)
     *   options.skipCooldown: bool   → Pro-Sound-Cooldown ignorieren (für UI-Feedback)
     */
    playSound(name, vol = 1.0, pitch = 1.0, options = {}) {
        try {
            if (!this.ctx || !this.buffers[name]) return;
            if (this.ctx.state === 'suspended') this.ctx.resume().catch(()=>{});

            // Pro-Sound-Cooldown: schützt vor "100x dieselbe Mob-Stimme im selben Frame"
            const now = performance.now();
            if (!options.skipCooldown) {
                const last = this.lastPlayedAt[name] || 0;
                if (now - last < MIN_REPEAT_MS) return;
            }
            this.lastPlayedAt[name] = now;

            // Spatial-Berechnung. Wenn außer Reichweite → gar nicht erst spielen.
            let volScale = 1.0, pan = 0;
            if (options.position) {
                const sp = this._computeSpatial(options.position);
                if (sp.volScale <= 0) return;
                volScale = sp.volScale;
                pan = sp.pan;
            }

            this._enforceVoiceCap();

            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers[name];
            source.playbackRate.value = pitch;

            const gain = this.ctx.createGain();
            gain.gain.value = vol * volScale;

            // StereoPanner ist nicht in jedem alten Safari verfügbar → defensiv
            let panner = null;
            if (options.position && typeof this.ctx.createStereoPanner === 'function') {
                panner = this.ctx.createStereoPanner();
                panner.pan.value = pan;
                source.connect(gain);
                gain.connect(panner);
                panner.connect(this.ctx.destination);
            } else {
                source.connect(gain);
                gain.connect(this.ctx.destination);
            }

            const voice = { source, gain, panner, startedAt: now };
            this.activeVoices.push(voice);
            source.onended = () => this._disposeVoice(voice);

            source.start();
        } catch (err) {
            console.warn("Play error:", err);
        }
    },

    // Mob-Sounds: zweites optionales Argument = Position für 3D-Spatial.
    // Aufrufer ohne Position-Argument funktionieren wie bisher (kein Breaking-Change).
    playChicken(pos) { this.playSound('chicken', 0.6, 0.9 + Math.random() * 0.2, pos ? { position: pos } : {}); },
    playPig(pos)     { this.playSound('pig',     0.8, 0.9 + Math.random() * 0.2, pos ? { position: pos } : {}); },
    playSheep(pos)   { this.playSound('sheep',   0.8, 0.9 + Math.random() * 0.2, pos ? { position: pos } : {}); },
    playCow(pos)     { this.playSound('cow',     0.9, 0.9 + Math.random() * 0.2, pos ? { position: pos } : {}); },
    playZombie(pos)  { this.playSound('zombie',  0.9, 0.8 + Math.random() * 0.4, pos ? { position: pos } : {}); },
    playSword()      { this.playSound('sword',   0.4, 0.9 + Math.random() * 0.2); },

    getSoundCategory(blockType) {
        if (blockType === 3) return 'stone'; // STONE
        if (blockType === 5 || blockType === 13 || blockType === 15) return 'wood'; // WOOD types
        if (blockType === 7 || blockType === 11 || blockType === 12) return 'sand'; // SAND, SNOW, ICE
        return 'grass'; // default dirt, grass, leaves
    },

    playStep(blockType) {
        const now = performance.now();
        if (now - (this.lastStepTime || 0) < 300) return;
        this.lastStepTime = now;
        const cat = this.getSoundCategory(blockType);
        this.playSound('step_' + cat, 1.0, 0.9 + Math.random() * 0.2);
    },

    playDig(blockType) {
        const cat = this.getSoundCategory(blockType);
        this.playSound('dig_' + cat, 0.7, 0.9 + Math.random() * 0.2);
    },

    playSplash() {
        this.playSound('water_splash', 1.0, 0.9 + Math.random() * 0.2);
    },

    setUnderwater(state) {
        if (!this.ctx) return;
        if (state) {
            if (this.uwSource) return;
            this.ctx.resume().then(() => {
                this.uwSource = this.ctx.createBufferSource();
                this.uwSource.buffer = this.buffers['underwater'];
                this.uwSource.loop = true;
                this.uwGain = this.ctx.createGain();
                this.uwGain.gain.value = 0.5;
                this.uwSource.connect(this.uwGain);
                this.uwGain.connect(this.ctx.destination);
                this.uwSource.start(0);
            });
        } else {
            if (this.uwSource) {
                try { this.uwSource.stop(); } catch(e) {}
                this.uwSource = null;
                this.uwGain = null;
            }
        }
    }
};
