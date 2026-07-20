import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('browser module identity', () => {
    it('loads the large block atlas module through one URL everywhere', () => {
        const consumers = [
            'js/GameMain.js',
            'js/PlayerInteraction.js',
            'js/furnace.js',
            'js/inventory.js',
            'js/mobs.js',
            'js/onboarding.js',
            'js/world.js'
        ];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/blocks\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./blocks.js?v=20260717z']));
    });

    it('cache-busts the browser entry after atlas changes', () => {
        const source = readFileSync('index.html', 'utf8');

        expect(source).toContain('./js/GameMain.js?v=20260720q');
    });

    it('loads world generation through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/newGameSpawn.js', 'js/weather.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/world\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./world.js?v=20260719b']));
    });

    it('loads inventory through one versioned URL everywhere', () => {
        const consumers = [
            'js/GameMain.js',
            'js/PlayerInteraction.js',
            'js/furnace.js',
            'js/itemCollection.js',
            'js/tradeUI.js'
        ];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/inventory\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./inventory.js?v=20260720q']));
    });

    it('loads the Game singleton through one versioned URL everywhere', () => {
        const consumers = [
            'js/GameMain.js',
            'js/PlayerInteraction.js',
            'js/furnace.js',
            'js/inventory.js',
            'js/mobs.js',
            'js/touch.js',
            'js/tradeUI.js'
        ];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/Game\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./Game.js?v=20260716b']));
    });

    it('loads touch detection through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/particles.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/touch\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./touch.js?v=20260720q']));
    });

    it('loads story progress through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/PlayerInteraction.js', 'js/tradeUI.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/storyProgress\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./storyProgress.js?v=20260720q']));
    });

    it('loads dialog focus management through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/PlayerInteraction.js', 'js/furnace.js', 'js/inventory.js', 'js/tradeUI.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/dialogFocus\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./dialogFocus.js?v=20260718b']));
    });

    it('loads the trade UI through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/PlayerInteraction.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/tradeUI\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./tradeUI.js?v=20260720q']));
    });

    it('loads the furnace through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/PlayerInteraction.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/furnace\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./furnace.js?v=20260719a']));
    });

    it('loads player interaction through the current browser URL', () => {
        const source = readFileSync('js/GameMain.js', 'utf8');

        expect(source).toContain('./PlayerInteraction.js?v=20260720q');
    });

    it('loads the graphics variant state through one URL everywhere', () => {
        const consumers = [
            'js/GameMain.js',
            'js/PlayerInteraction.js',
            'js/blocks.js',
            'js/characterModel.js',
            'js/entityMaterials.js',
            'js/particles.js',
            'js/weather.js',
            'js/world.js'
        ];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/graphicsPrototype\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./graphicsPrototype.js?v=20260718c']));
    });

    it('loads torch lighting through one URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/Player.js', 'js/PlayerInteraction.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/torchLights\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./torchLights.js?v=20260719a']));
    });
});
