import { describe, it, expect, afterEach, vi } from 'vitest';

vi.mock('../js/particles.js', () => ({
    ParticleSystem: class {
        update() {}
        dispose() {}
    }
}));

vi.mock('../js/world.js', () => ({
    BIOMES: {
        OCEAN: 'Ozean',
        DESERT: 'Wüste',
        JUNGLE: 'Urwald',
        SNOW: 'Schneefeld',
        PLAINS: 'Grasland'
    }
}));

vi.mock('../js/sound.js', () => ({
    SoundManager: {
        playRainLoop() {},
        playThunder() {}
    }
}));

const { WeatherSystem } = await import('../js/weather.js');
const { BIOMES } = await import('../js/world.js');

function createWeather() {
    return new WeatherSystem({}, { fireBlocks: new Map() });
}

describe('WeatherSystem transitions', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('keeps desert clear without hidden rain intensity', () => {
        const weather = createWeather();

        weather._transitionState(BIOMES.DESERT);

        expect(weather.getState()).toBe('clear');
        expect(weather.targetIntensity).toBe(0);
    });

    it('starts precipitation after clear weather in rainy biomes', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const weather = createWeather();

        weather._transitionState(BIOMES.PLAINS);

        expect(weather.getState()).toBe('rain');
        expect(weather.targetIntensity).toBeGreaterThan(0);
    });

    it('uses snow instead of rain in snow biomes', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const weather = createWeather();

        weather._transitionState(BIOMES.SNOW);

        expect(weather.getState()).toBe('snow');
        expect(weather.targetIntensity).toBeGreaterThan(0);
    });

    it('raises storm chance after rainy cycles without thunderstorms', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.4);
        const weather = createWeather();

        weather.state = 'rain';
        weather._transitionState(BIOMES.PLAINS);

        expect(weather.getState()).toBe('clear');
        expect(weather.rainCyclesWithoutStorm).toBe(1);

        weather.state = 'rain';
        weather._transitionState(BIOMES.PLAINS);

        expect(weather.getState()).toBe('thunderstorm');
        expect(weather.rainCyclesWithoutStorm).toBe(0);
    });

    it('schedules the first thunderstorm lightning promptly', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const weather = createWeather();

        weather.state = 'rain';
        weather._transitionState(BIOMES.PLAINS);

        expect(weather.getState()).toBe('thunderstorm');
        expect(weather.lightningTimer).toBeGreaterThanOrEqual(0.5);
        expect(weather.lightningTimer).toBeLessThan(3);
    });

    it('adds and clears a visible lightning bolt', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const added = [];
        const removed = [];
        const scene = {
            add: (obj) => added.push(obj),
            remove: (obj) => removed.push(obj)
        };
        const weather = new WeatherSystem(scene, { fireBlocks: new Map() });

        weather._showLightningBolt(1, 20, 2);

        expect(added).toHaveLength(1);
        expect(weather.lightningBolt).toBe(added[0]);
        expect(weather.lightningVisualTimer).toBeGreaterThan(0);

        weather.update(0.3, { x: 0, y: 0, z: 0 }, BIOMES.PLAINS);

        expect(removed).toContain(added[0]);
        expect(weather.lightningBolt).toBeNull();
    });

    it('persists rainy cycles without thunderstorms', () => {
        const weather = createWeather();
        weather.rainCyclesWithoutStorm = 2;

        const restored = createWeather();
        restored.deserialize(weather.serialize());

        expect(restored.rainCyclesWithoutStorm).toBe(2);
    });
});
