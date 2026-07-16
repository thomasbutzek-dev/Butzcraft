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

        expect(new Set(specifiers)).toEqual(new Set(['./inventory.js?v=20260716b']));
    });
});
