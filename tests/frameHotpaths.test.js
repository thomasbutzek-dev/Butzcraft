import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('main frame hotpaths', () => {
    it('avoids computed-style reads and throttles passive objective checks', () => {
        const source = readFileSync('js/GameMain.js', 'utf8');

        expect(source).not.toContain('getComputedStyle(el)');
        expect(source).toContain('blockingOverlayElements ||= [');
        expect(source).toContain('updateFirstObjective(false, now);');
        expect(source).toContain('function updateDroppedItems(items, delta, playerPos)');
        expect(source).not.toContain('const updateItems = (items) =>');
        expect(source).not.toContain('Math.hypot(ip.x - playerPos.x');
        expect(source).not.toContain('const onPlayerDamage = (d) =>');
        expect(source).toContain('m.update(delta, playerPos, world, applyPlayerDamage, dayRatio, now, heldItemType)');
    });
});
