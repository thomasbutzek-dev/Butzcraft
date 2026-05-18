import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CONFIG } from '../config.js';

describe('spider mob', () => {
    it('ist als leichter Dungeon-Gegner balanciert', () => {
        expect(CONFIG.MOBS.SPIDER_DAMAGE).toBeGreaterThan(0);
        expect(CONFIG.MOBS.SPIDER_DAMAGE).toBeLessThan(CONFIG.MOBS.ZOMBIE_DAMAGE);
        expect(CONFIG.MOBS.SPIDER_DETECTION_RANGE).toBeLessThan(CONFIG.MOBS.ZOMBIE_DETECTION_RANGE);
    });

    it('ist im Mob-Builder und Hostile-Update verdrahtet', () => {
        const source = readFileSync('js/mobs.js', 'utf8');
        expect(source).toContain("type === 'spider'");
        expect(source).toContain('_buildSpider()');
        expect(source).toContain('SPIDER_DAMAGE * delta');
    });
});
