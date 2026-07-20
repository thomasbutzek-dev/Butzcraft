import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SoundManager } from '../js/sound.js';

class FakeAudioContext {
    constructor() {
        this.state = 'running';
        this.destination = {};
        this.currentTime = 0;
        this.sampleRate = 8000;
        this.resumePromise = Promise.resolve();
        this.sources = [];
    }

    resume() {
        return this.resumePromise;
    }

    decodeAudioData() {
        return Promise.resolve({ duration: 1 });
    }

    createBufferSource() {
        const source = {
            buffer: null,
            onended: null,
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            disconnect: vi.fn()
        };
        this.sources.push(source);
        return source;
    }

    createGain() {
        return {
            gain: { value: 0, linearRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            disconnect: vi.fn()
        };
    }

    createBuffer(channels, length) {
        return {
            getChannelData: () => new Float32Array(length)
        };
    }

    createBiquadFilter() {
        return {
            type: '',
            frequency: { value: 0 },
            Q: { value: 0 },
            connect: vi.fn(),
            disconnect: vi.fn()
        };
    }
}

function resetSoundManager() {
    SoundManager.ctx = null;
    SoundManager.buffers = {};
    SoundManager.activeVoices = [];
    SoundManager.lastPlayedAt = {};
    SoundManager.listener = null;
    SoundManager.musicBuffer = null;
    SoundManager.musicLoading = false;
    SoundManager.musicTimer = null;
    SoundManager.musicSource = null;
    SoundManager.uwSource = null;
    SoundManager.uwGain = null;
    SoundManager.uwWanted = false;
    SoundManager.uwStarting = false;
    SoundManager._rainSource = null;
    SoundManager._rainFilter = null;
    SoundManager._rainGain = null;
    SoundManager._rainWanted = false;
    SoundManager._rainStarting = false;
}

describe('SoundManager music loop', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetSoundManager();
        window.AudioContext = FakeAudioContext;
        window.webkitAudioContext = undefined;
        globalThis.fetch = vi.fn(() => Promise.resolve({
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))
        }));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        resetSoundManager();
    });

    it('does not schedule duplicate music starts while loading', async () => {
        SoundManager.init();
        SoundManager.init();
        SoundManager.startMusicLoop();

        const musicFetches = fetch.mock.calls.filter(([url]) => url === 'sounds/music.ogg');
        expect(musicFetches).toHaveLength(1);

        await vi.waitFor(() => {
            expect(SoundManager.musicLoading).toBe(false);
        });
        expect(vi.getTimerCount()).toBe(1);
    });

    it('does not start a second music source while one is active', () => {
        SoundManager.ctx = new FakeAudioContext();
        SoundManager.musicBuffer = { duration: 1 };

        SoundManager.playMusicSequence();
        const firstSource = SoundManager.musicSource;
        SoundManager.playMusicSequence();

        expect(SoundManager.musicSource).toBe(firstSource);
    });
});

describe('SoundManager listener updates', () => {
    afterEach(() => resetSoundManager());

    it('reuses listener vectors across animation frames', () => {
        const camera = {
            position: { x: 1, y: 2, z: 3 },
            quaternion: { x: 0, y: 0, z: 0, w: 1 }
        };
        SoundManager.updateListener(camera);
        const listener = SoundManager.listener;
        const position = listener.pos;
        const forward = listener.forward;
        const right = listener.right;

        camera.position.x = 4;
        SoundManager.updateListener(camera);

        expect(SoundManager.listener).toBe(listener);
        expect(SoundManager.listener.pos).toBe(position);
        expect(SoundManager.listener.forward).toBe(forward);
        expect(SoundManager.listener.right).toBe(right);
        expect(SoundManager.listener.pos.x).toBe(4);
    });
});

describe('SoundManager looping ambience', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetSoundManager();
        window.AudioContext = FakeAudioContext;
        window.webkitAudioContext = undefined;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        resetSoundManager();
    });

    it('does not start underwater loop before the buffer is loaded', async () => {
        SoundManager.ctx = new FakeAudioContext();

        SoundManager.setUnderwater(true);
        await Promise.resolve();

        expect(SoundManager.uwSource).toBeNull();
        expect(SoundManager.ctx.sources).toHaveLength(0);
    });

    it('cancels a pending underwater start when leaving water', async () => {
        SoundManager.ctx = new FakeAudioContext();
        SoundManager.buffers.underwater = { duration: 1 };
        let resume;
        SoundManager.ctx.resumePromise = new Promise(resolve => { resume = resolve; });

        SoundManager.setUnderwater(true);
        SoundManager.setUnderwater(false);
        resume();
        await Promise.resolve();
        await Promise.resolve();

        expect(SoundManager.uwSource).toBeNull();
        expect(SoundManager.ctx.sources).toHaveLength(0);
    });

    it('does not start duplicate rain loops while audio resume is pending', async () => {
        SoundManager.ctx = new FakeAudioContext();
        let resume;
        SoundManager.ctx.resumePromise = new Promise(resolve => { resume = resolve; });

        SoundManager.playRainLoop(true);
        SoundManager.playRainLoop(true);
        resume();
        await Promise.resolve();
        await Promise.resolve();

        expect(SoundManager._rainSource).toBeTruthy();
        expect(SoundManager.ctx.sources).toHaveLength(1);
    });
});
