import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('browser module identity', () => {
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

        expect(new Set(specifiers)).toEqual(new Set(['./inventory.js?v=20260716i']));
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

        expect(new Set(specifiers)).toEqual(new Set(['./touch.js?v=20260716d']));
    });

    it('loads the trade UI through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/PlayerInteraction.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/tradeUI\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./tradeUI.js?v=20260716h']));
    });

    it('loads the furnace through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/PlayerInteraction.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/furnace\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./furnace.js?v=20260716g']));
    });
});
