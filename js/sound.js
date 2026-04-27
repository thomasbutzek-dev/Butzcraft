export const SoundManager = {
            ctx: null,
            buffers: {},
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
            playSound(name, vol = 1.0, pitch = 1.0) {
                try {
                    if (!this.ctx || !this.buffers[name]) return;
                    if (this.ctx.state === 'suspended') this.ctx.resume().catch(()=>{});
                    const source = this.ctx.createBufferSource();
                    source.buffer = this.buffers[name];
                    source.playbackRate.value = pitch;
                    
                    const gain = this.ctx.createGain();
                    gain.gain.value = vol;
                    
                    source.connect(gain);
                    gain.connect(this.ctx.destination);
                    source.start();
                } catch (err) {
                    console.warn("Play error:", err);
                }
            },
            playChicken() { this.playSound('chicken', 0.6, 0.9 + Math.random() * 0.2); },
            playPig() { this.playSound('pig', 0.8, 0.9 + Math.random() * 0.2); },
            playSheep() { this.playSound('sheep', 0.8, 0.9 + Math.random() * 0.2); },
            playCow() { this.playSound('cow', 0.9, 0.9 + Math.random() * 0.2); },
            playZombie() { this.playSound('zombie', 0.9, 0.8 + Math.random() * 0.4); },
            playSword() { this.playSound('sword', 0.4, 0.9 + Math.random() * 0.2); },
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
        }
