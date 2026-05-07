import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SoundManager } from '../js/sound.js';

class FakeAudioContext {
    constructor() {
        this.state = 'running';
        this.destination = {};
    }

    resume() {
        return Promise.resolve();
    }

    decodeAudioData() {
        return Promise.resolve({ duration: 1 });
    }

    createBufferSource() {
        return {
            buffer: null,
            onended: null,
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            disconnect: vi.fn()
        };
    }

    createGain() {
        return {
            gain: { value: 0 },
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
