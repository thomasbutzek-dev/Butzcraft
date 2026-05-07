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
});
